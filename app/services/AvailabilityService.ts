// src/lib/availability-service.ts
import { prisma } from '@/lib/prisma';

// If you already have these in a shared types file, import them instead.
// I'm declaring minimal shapes here to keep it self-contained.
export interface TimeSlot {
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  available: boolean;
  power_consumption: number; // kW
  power_spike_percentage: number;
  machine_ids: string[]; // keep as string[] to match previous UI/types
  reason?: string;
}

export interface EfficiencyGroup {
  id: 'optimal' | 'good' | 'regular' | 'high' | 'very-high';
  label: string;
  power_spike_percentage: number;
  time_range: string; // "HH:MM - HH:MM"
  slots: TimeSlot[];
  average_power_consumption: number;
}

export interface AvailabilityOptions {
  date: Date;
  laboratoryId: number;
  machineId?: number;     // single machine (optional)
  machineIds?: number[];  // multiple machines
  duration?: number;      // in hours, default 2
  maxPowerConsumption?: number;
}

export interface AvailabilityResult {
  timeSlots: TimeSlot[];
  efficiencyGroups: EfficiencyGroup[];
}

type ExistingAppointmentLight = {
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  power_consumption: number; // kW
  status: string;
};

type PreferredHourLight = {
  day_of_week: number;
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  power_consumption: number; // kW
};

type MachineLight = {
  id: string; // keep string to match your previous UI
  power_consumption: number; // kW
};

export class AvailabilityService {
  private static readonly WORKING_HOURS_START = 8; // starts at 8 am
  private static readonly WORKING_HOURS_END = 18; // ends at 6 pm
  private static readonly DEFAULT_SLOT_DURATION = 2; // hours
  private static readonly MAX_DAILY_CONSUMPTION = 50; // kW total per day (not enforced; used for recs/future)
  private static readonly PEAK_CONSUMPTION_THRESHOLD = 4.0; // kW per slot
  private static readonly SLOT_INCREMENT_MINUTES = 30; // Generate slots every 30 minutes

  /**
   * Check availability for a specific date and laboratory/machine combination
   */
  static async checkAvailability(options: AvailabilityOptions): Promise<AvailabilityResult> {
    const {
      date,
      laboratoryId,
      machineId,
      machineIds,
      duration = this.DEFAULT_SLOT_DURATION,
    } = options;

    // Normalize target machine IDs (numbers -> strings for UI payload)
    const targetMachineIdsNum: number[] =
      machineIds && machineIds.length > 0
        ? machineIds
        : typeof machineId === 'number'
          ? [machineId]
          : [];
    if (targetMachineIdsNum.length === 0) {
      // caller should validate, but keep a defensive guard
      return {
        timeSlots: [],
        recommendations: { energyEfficientSlots: [] },
        totalDayConsumption: 0,
        peakHours: [],
        efficiencyGroups: [],
      };
    }
    const targetMachineIdsStr = targetMachineIdsNum.map(String);
    console.log(`Checking availability for lab ${laboratoryId} on ${date.toDateString()} for machines [${targetMachineIdsStr.join(', ')}] for duration ${duration}h`);
    // --- Fetch data from DB (Prisma) ---

    // Day range [startOfDay, nextDay)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const nextDay = new Date(startOfDay);
    nextDay.setDate(startOfDay.getDate() + 1);

    // Appointments that involve ANY of the requested machines (for conflicts)
    const dbAppointmentsConflicting = await prisma.appointment.findMany({
      where: {
        laboratory_id: laboratoryId,
        appointment_date: { gte: startOfDay, lt: nextDay },
        status: { notIn: ['cancelled', 'CANCELLED'] },
        machines: { some: { id: { in: targetMachineIdsNum } } },
      },
      select: {
        start_time: true,
        end_time: true,
        power_consumption: true,
        status: true,
      },
    });

    // All appointments in the lab (for power load)
    const dbAppointmentsAll = await prisma.appointment.findMany({
      where: {
        appointment_date: { gte: startOfDay, lt: nextDay },
        status: { notIn: ['cancelled', 'CANCELLED'] },
      },
      select: {
        start_time: true,
        end_time: true,
        power_consumption: true,
        status: true,
      },
    });
    // Convert to light shapes
    const conflictingAppointments: ExistingAppointmentLight[] = dbAppointmentsConflicting.map((a) => ({
      start_time: this.timeFromDate(a.start_time),
      end_time: this.timeFromDate(a.end_time),
      power_consumption: Number(a.power_consumption ?? 0),
      status: a.status,
    }));

    const allAppointmentsForLoad: ExistingAppointmentLight[] = dbAppointmentsAll.map((a) => ({
      start_time: this.timeFromDate(a.start_time),
      end_time: this.timeFromDate(a.end_time),
      power_consumption: Number(a.power_consumption ?? 0),
      status: a.status,
    }));

    // Preferred hours for that day-of-week (0=Sun .. 6=Sat)
    const dayOfWeek = startOfDay.getDay();
    const dbPreferred = await prisma.preferredHour.findMany({
      where: { day_of_week: dayOfWeek },
      select: { day_of_week: true, start_time: true, end_time: true, power_consumption: true },
      orderBy: [{ start_time: 'asc' }],
    });
    const preferredHours: PreferredHourLight[] = dbPreferred.map((p) => ({
      day_of_week: p.day_of_week,
      start_time: this.timeFromDate(p.start_time),
      end_time: this.timeFromDate(p.end_time),
      power_consumption: Number(p.power_consumption),
    }));
    console.log(`Found ${preferredHours.length} preferred hours for dayOfWeek ${dayOfWeek}.`);
    for (const ph of preferredHours) {
      console.log(` Preferred: ${ph.start_time} - ${ph.end_time}, power: ${ph.power_consumption} kW`);
    }
    // Machines details (validate they belong to the lab)
    const dbMachines = await prisma.machine.findMany({
      where: { id: { in: targetMachineIdsNum }, laboratory_id: laboratoryId },
      select: { id: true, power_consumption: true },
    });
    const machines: MachineLight[] = dbMachines.map((m) => ({
      id: String(m.id),
      power_consumption: Number(m.power_consumption),
    }));

    // --- Generate time slots / analytics ---

    const timeSlots = this.generateTimeSlots(
      date,
      laboratoryId,
      targetMachineIdsStr,
      duration,
      conflictingAppointments,     // for conflicts
      preferredHours,
      machines,
      allAppointmentsForLoad       // for weighted lab load
    );

    const efficiencyGroups = this.groupSlotsByEfficiency(timeSlots);
    return {
      timeSlots,
      //totalDayConsumption,
      //peakHours,
      efficiencyGroups,
    };
  }

  /** Generate available time slots with power consumption calculations */
  private static generateTimeSlots(
    date: Date,
    laboratoryId: number,
    machineIds: string[],
    duration: number,
    conflictingAppointments: ExistingAppointmentLight[],
    preferredHours: PreferredHourLight[],
    machines: MachineLight[],
    allAppointmentsForLoad: ExistingAppointmentLight[],
  ): TimeSlot[] {
    const timeSlots: TimeSlot[] = [];
    const totalMachinePower = machines.reduce((sum, m) => sum + m.power_consumption, 0);
    const slotIncrementHours = this.SLOT_INCREMENT_MINUTES / 60;
    const maxEndHour = this.WORKING_HOURS_END;

    for (
      let startHour = this.WORKING_HOURS_START;
      startHour + duration <= maxEndHour;
      startHour += slotIncrementHours
    ) {
      const endHour = startHour + duration;
      const startTime = this.formatTime(startHour);
      const endTime = this.formatTime(endHour);
      const slotMinutes = this.timeToMinutes(endTime) - this.timeToMinutes(startTime);
      console.log(`Evaluating slot ${startTime} - ${endTime}`);

      // 1) Conflicts: any appointment with the requested machines that overlaps this slot blocks it
      const hasConflict = conflictingAppointments.some((a) =>
        this.timeSlotsOverlap(startTime, endTime, a.start_time, a.end_time)
      );

      // 2) Preferred-hours weighted power
      const preferredWeighted = preferredHours.reduce((sum, pref) => {
        const mins = this.overlapMinutes(startTime, endTime, pref.start_time, pref.end_time);
        if (mins === 0) return sum;
        const fraction = mins / slotMinutes;
        return sum + fraction * pref.power_consumption; // kW contribution
      }, 0);

      // 3) Concurrent appointments (ALL lab appointments) weighted power
      const concurrentWeighted = allAppointmentsForLoad.reduce((sum, appt) => {
        const mins = this.overlapMinutes(startTime, endTime, appt.start_time, appt.end_time);
        console.log(`Checking overlap with appointment ${appt.start_time}-${appt.end_time} (${appt.power_consumption} kW): overlap ${mins} mins`);
        if (mins === 0) return sum;
        const appSlotMinutes = this.timeToMinutes(appt.end_time) - this.timeToMinutes(appt.start_time);
        const fraction = mins / appSlotMinutes;
        return sum + fraction * (appt.power_consumption || 0);
      }, 0);
      console.log(` Slot ${startTime}-${endTime}: preferred contribution = ${preferredWeighted.toFixed(2)} kW, concurrent contribution = ${concurrentWeighted.toFixed(2)} kW`);
      // 4) Extra power = preferred contribution + concurrent appointments contribution
      const extraPowerConsumption = preferredWeighted + concurrentWeighted;

      let reason: string | undefined;
      if (hasConflict) {
        reason = 'Horario ya reservado';
      } else if (extraPowerConsumption > this.PEAK_CONSUMPTION_THRESHOLD) {
        reason = `Alto consumo energético (${extraPowerConsumption.toFixed(1)} kW)`;
      }

      timeSlots.push({
        start_time: startTime,
        end_time: endTime,
        available: !hasConflict,
        power_consumption: extraPowerConsumption,
        power_spike_percentage: 0, // filled after sorting
        machine_ids: machineIds,
        reason,
      });
    }

    // Sort by power first, then by time
    const sortedSlots = timeSlots.sort((a, b) => {
      if (a.power_consumption !== b.power_consumption) {
        return a.power_consumption - b.power_consumption;
      }
      return a.start_time.localeCompare(b.start_time);
    });

    const lowestPower = sortedSlots.length > 0 ? sortedSlots[0].power_consumption : 0;

    return sortedSlots.map((slot) => ({
      ...slot,
      power_spike_percentage:
        lowestPower > 0 ? ((slot.power_consumption - lowestPower) / lowestPower) * 100 : slot.power_consumption,
    }));
  }


  // --- Helpers ---

  /** Convert fractional hour to "HH:MM" */
  private static formatTime(hour: number): string {
    const hours = Math.floor(hour);
    const minutes = Math.round((hour - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /** Convert Date(@db.Time()) to "HH:MM" */
  private static timeFromDate(d: Date): string {
    const offset = 3 // Argentina Standard Time (UTC-3)
    const hh = (d.getHours() + offset).toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private static timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private static timeSlotsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const s1 = this.timeToMinutes(start1);
    const e1 = this.timeToMinutes(end1);
    const s2 = this.timeToMinutes(start2);
    const e2 = this.timeToMinutes(end2);
    return s1 < e2 && e1 > s2;
  }

  private static timeWithinRange(slotStart: string, slotEnd: string, rangeStart: string, rangeEnd: string): boolean {
    const s = this.timeToMinutes(slotStart);
    const e = this.timeToMinutes(slotEnd);
    const rs = this.timeToMinutes(rangeStart);
    const re = this.timeToMinutes(rangeEnd);
    return s >= rs && e <= re;
  }

  /** Group slots by relative power efficiency */
  static groupSlotsByEfficiency(timeSlots: TimeSlot[]): EfficiencyGroup[] {
    if (timeSlots.length === 0) return [];

    const sorted = [...timeSlots].sort((a, b) => {
      if (a.power_consumption !== b.power_consumption) {
        return a.power_consumption - b.power_consumption;
      }
      return a.start_time.localeCompare(b.start_time);
    });

    const lowestPower = sorted[0]?.power_consumption || 0;
    const ranges = [
      { max: 10, label: 'Óptimo', id: 'optimal' as const },
      { max: 30, label: 'Bueno', id: 'good' as const },
      { max: 50, label: 'Regular', id: 'regular' as const },
      { max: 500, label: 'Alto', id: 'high' as const },
      { max: Number.POSITIVE_INFINITY, label: 'Muy Alto', id: 'very-high' as const },
    ];

    const groups: EfficiencyGroup[] = [];
    ranges.forEach((range, idx) => {
      const prevMax = idx > 0 ? ranges[idx - 1].max : 0;
      const rangeSlots = sorted.filter((slot) => {
        const pct =
          lowestPower > 0 ? ((slot.power_consumption - lowestPower) / lowestPower) * 100 : 0;
        return pct >= prevMax && pct < range.max;
      });

      if (rangeSlots.length > 0) {
        // ✅ Find earliest start and latest end by time (not by power sort)
        const earliestStart = rangeSlots.reduce((min, s) =>
          this.timeToMinutes(s.start_time) < this.timeToMinutes(min) ? s.start_time : min
          , rangeSlots[0].start_time);

        const latestEnd = rangeSlots.reduce((max, s) =>
          this.timeToMinutes(s.end_time) > this.timeToMinutes(max) ? s.end_time : max
          , rangeSlots[0].end_time);

        const avgPower =
          rangeSlots.reduce((sum, slot) => sum + slot.power_consumption, 0) / rangeSlots.length;
        const avgPct = lowestPower > 0 ? ((avgPower - lowestPower) / lowestPower) * 100 : 0;

        groups.push({
          id: range.id,
          label: range.label,
          power_spike_percentage: Math.round(avgPct),
          time_range: `${earliestStart} - ${latestEnd}`, // ✅ correct range
          slots: rangeSlots,
          average_power_consumption: avgPower,
        });
      }
    });

    return groups;
  }

  private static overlapMinutes(start1: string, end1: string, start2: string, end2: string): number {
    const s1 = this.timeToMinutes(start1);
    const e1 = this.timeToMinutes(end1);
    const s2 = this.timeToMinutes(start2);
    const e2 = this.timeToMinutes(end2);
    const overlap = Math.min(e1, e2) - Math.max(s1, s2);
    return Math.max(0, overlap);
  }
}
