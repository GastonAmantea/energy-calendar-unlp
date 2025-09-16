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
  recommendations: {
    bestSlot?: TimeSlot;
    energyEfficientSlots: TimeSlot[];
    alternativeDates?: Date[];
  };
  totalDayConsumption: number;
  peakHours: string[];
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

    // --- Fetch data from DB (Prisma) ---

    // Day range [startOfDay, nextDay)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const nextDay = new Date(startOfDay);
    nextDay.setDate(startOfDay.getDate() + 1);

    // Appointments for that day/lab that involve ANY of the requested machines
    const dbAppointments = await prisma.appointment.findMany({
      where: {
        laboratory_id: laboratoryId,
        appointment_date: { gte: startOfDay, lt: nextDay },
        
        status: { notIn: ['cancelled', 'CANCELLED'] },
        machines: { some: { id: { in: targetMachineIdsNum } } },
      },
      select: {
        start_time: true, // Prisma returns a Date for @db.Time()
        end_time: true,
        power_consumption: true, // Decimal | null
        status: true,
        // machines: { select: { id: true } }, // not needed in the light view here
      },
    });

    // Convert to lightweight, UI-consumable appointments
    const existingAppointments: ExistingAppointmentLight[] = dbAppointments.map((a) => ({
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
      existingAppointments,
      preferredHours,
      machines
    );

    const totalDayConsumption = this.calculateTotalDayConsumption(existingAppointments, timeSlots);
    const peakHours = this.identifyPeakHours(timeSlots);
    const recommendations = this.generateRecommendations(timeSlots, date, laboratoryId);
    const efficiencyGroups = this.groupSlotsByEfficiency(timeSlots);

    return {
      timeSlots,
      recommendations,
      totalDayConsumption,
      peakHours,
      efficiencyGroups,
    };
  }

  /** Generate available time slots with power consumption calculations */
  private static generateTimeSlots(
    date: Date,
    laboratoryId: number,
    machineIds: string[],
    duration: number, // hours
    existingAppointments: ExistingAppointmentLight[],
    preferredHours: PreferredHourLight[],
    machines: MachineLight[]
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

      // Conflicts with any appointment that overlaps the same time window
      const hasConflict = existingAppointments.some((a) =>
        this.timeSlotsOverlap(startTime, endTime, a.start_time, a.end_time)
      );

      const overlappingPreferredHours = preferredHours.filter(
        (pref) =>
          this.timeWithinRange(startTime, endTime, pref.start_time, pref.end_time) ||
          this.timeSlotsOverlap(startTime, endTime, pref.start_time, pref.end_time)
      );

      // Base power consumption from selected machines
      let powerConsumption = totalMachinePower;

      if (overlappingPreferredHours.length > 0) {
        const avgPreferred =
          overlappingPreferredHours.reduce((sum, pref) => sum + pref.power_consumption, 0) /
          overlappingPreferredHours.length;
        powerConsumption += avgPreferred;
      } else {
        powerConsumption += this.calculateNonPreferredHourConsumption(startHour);
      }

      // Optional: environmental factors
      // powerConsumption += this.calculateEnvironmentalFactors(date, startHour);

      let reason: string | undefined;
      if (hasConflict) {
        reason = 'Horario ya reservado';
      } else if (powerConsumption > this.PEAK_CONSUMPTION_THRESHOLD) {
        reason = `Alto consumo energético (${powerConsumption.toFixed(1)} kW)`;
      }

      timeSlots.push({
        start_time: startTime,
        end_time: endTime,
        available: !hasConflict,
        power_consumption: powerConsumption,
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
        lowestPower > 0 ? ((slot.power_consumption - lowestPower) / lowestPower) * 100 : 0,
    }));
  }

  /** Identify peak consumption hours */
  private static identifyPeakHours(timeSlots: TimeSlot[]): string[] {
    return timeSlots
      .filter((slot) => slot.power_consumption > this.PEAK_CONSUMPTION_THRESHOLD)
      .map((slot) => `${slot.start_time}-${slot.end_time}`);
  }

  /** Calculate total power consumption for the day */
  private static calculateTotalDayConsumption(
    existingAppointments: ExistingAppointmentLight[],
    availableSlots: TimeSlot[]
  ): number {
    const existingConsumption = existingAppointments.reduce(
      (total, a) => total + (a.power_consumption || 0),
      0
    );

    // Estimated consumption from available slots that might get booked (30% probability)
    const potentialConsumption =
      availableSlots
        .filter((slot) => slot.available)
        .reduce((total, slot) => total + slot.power_consumption, 0) * 0.3;

    return existingConsumption + potentialConsumption;
  }

  /** Generate recommendations for optimal booking */
  private static generateRecommendations(
    timeSlots: TimeSlot[],
    date: Date,
    laboratoryId: number
  ): AvailabilityResult['recommendations'] {
    const availableSlots = timeSlots.filter((slot) => slot.available);

    const energyEfficientSlots = availableSlots
      .filter((slot) => slot.power_consumption <= 3.0)
      .sort((a, b) => a.power_consumption - b.power_consumption)
      .slice(0, 3);

    const bestSlot = [...availableSlots].sort((a, b) => {
      const powerDiff = a.power_consumption - b.power_consumption;
      if (Math.abs(powerDiff) > 0.5) return powerDiff;
      const timeA = this.timeToMinutes(a.start_time);
      const timeB = this.timeToMinutes(b.start_time);
      return timeA - timeB;
    })[0];

    const alternativeDates =
      availableSlots.length < 3 ? this.generateAlternativeDates(date, laboratoryId) : undefined;

    return { bestSlot, energyEfficientSlots, alternativeDates };
  }

  /** Generate alternative dates with better availability */
  private static generateAlternativeDates(date: Date, _laboratoryId: number): Date[] {
    const alternatives: Date[] = [];
    const currentDate = new Date(date);

    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(currentDate.getDate() + i);
      // Skip weekends
      if (nextDate.getDay() !== 0 && nextDate.getDay() !== 6) {
        alternatives.push(nextDate);
      }
    }
    return alternatives.slice(0, 3);
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
    // Using local time here; if you need a fixed TZ (e.g., America/Argentina/Buenos_Aires),
    // consider using a library or Intl.DateTimeFormat with that timeZone.
    const hh = d.getHours().toString().padStart(2, '0');
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

  /** Power model for non-preferred hours */
  private static calculateNonPreferredHourConsumption(hour: number): number {
    if ((hour >= 10 && hour < 12) || (hour >= 14 && hour < 16)) {
      return 2.5; // high
    } else if (hour >= 8 && hour < 10) {
      return 1.5; // medium
    } else {
      return 2.0; // standard
    }
  }

  /** Optional: environmental modifiers (kept for parity, currently unused) */
  private static calculateEnvironmentalFactors(date: Date, hour: number): number {
    let factor = 0;
    if (date.getDay() === 0 || date.getDay() === 6) factor -= 0.3;
    const month = date.getMonth();
    if (month >= 5 && month <= 7) factor += 0.5; // Jun–Aug
    if (hour >= 12 && hour <= 16) factor += 0.3;
    return Math.max(0, factor);
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
      { max: 5, label: 'Óptimo', id: 'optimal' as const },
      { max: 15, label: 'Bueno', id: 'good' as const },
      { max: 30, label: 'Regular', id: 'regular' as const },
      { max: 50, label: 'Alto', id: 'high' as const },
      { max: Number.POSITIVE_INFINITY, label: 'Muy Alto', id: 'very-high' as const },
    ];

    const groups: EfficiencyGroup[] = [];
    ranges.forEach((range, idx) => {
      const prevMax = idx > 0 ? ranges[idx - 1].max : 0;
      const rangeSlots = sorted.filter((slot) => {
        const pct = lowestPower > 0 ? ((slot.power_consumption - lowestPower) / lowestPower) * 100 : 0;
        return pct >= prevMax && pct < range.max;
      });

      if (rangeSlots.length > 0) {
        const firstSlot = rangeSlots[0];
        const lastSlot = rangeSlots[rangeSlots.length - 1];
        const avgPower = rangeSlots.reduce((sum, slot) => sum + slot.power_consumption, 0) / rangeSlots.length;
        const avgPct = lowestPower > 0 ? ((avgPower - lowestPower) / lowestPower) * 100 : 0;

        groups.push({
          id: range.id,
          label: range.label,
          power_spike_percentage: Math.round(avgPct),
          time_range: `${firstSlot.start_time} - ${lastSlot.end_time}`,
          slots: rangeSlots,
          average_power_consumption: avgPower,
        });
      }
    });

    return groups;
  }

  /** Scan multiple days for optimal slots for a single machine */
  static async getOptimalSlots(
    laboratoryId: number,
    machineId: number,
    startDate: Date,
    days = 7
  ): Promise<{ date: Date; slots: TimeSlot[] }[]> {
    const results: { date: Date; slots: TimeSlot[] }[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const availability = await this.checkAvailability({
        date,
        laboratoryId,
        machineId,
      });

      const optimalSlots = availability.timeSlots
        .filter((slot) => slot.available && slot.power_consumption <= 3.0)
        .sort((a, b) => a.power_consumption - b.power_consumption)
        .slice(0, 2);

      if (optimalSlots.length > 0) {
        results.push({ date, slots: optimalSlots });
      }
    }

    return results;
  }
}
