import type { Appointment, PreferredHour, Machine, TimeSlot, EfficiencyGroup } from "./types"
import { mockAppointments, mockPreferredHours, mockMachines, mockLaboratories } from "./mock-data"

export interface AvailabilityOptions {
  date: Date
  laboratoryId: string
  machineId?: string
  machineIds?: string[] // Support multiple machine IDs
  duration?: number // in hours, default 2
  maxPowerConsumption?: number // maximum allowed power consumption
}

export interface AvailabilityResult {
  timeSlots: TimeSlot[]
  recommendations: {
    bestSlot?: TimeSlot
    energyEfficientSlots: TimeSlot[]
    alternativeDates?: Date[]
  }
  totalDayConsumption: number
  peakHours: string[]
  efficiencyGroups: EfficiencyGroup[]
}

export class AvailabilityService {
  private static readonly WORKING_HOURS_START = 8
  private static readonly WORKING_HOURS_END = 18
  private static readonly DEFAULT_SLOT_DURATION = 2 // hours
  private static readonly MAX_DAILY_CONSUMPTION = 50 // kW total per day
  private static readonly PEAK_CONSUMPTION_THRESHOLD = 4.0 // kW per slot
  private static readonly SLOT_INCREMENT_MINUTES = 30 // Generate slots every 30 minutes

  /**
   * Check availability for a specific date and laboratory/machine combination
   */
  static async checkAvailability(options: AvailabilityOptions): Promise<AvailabilityResult> {
    const { date, laboratoryId, machineId, machineIds, duration = this.DEFAULT_SLOT_DURATION } = options

    const targetMachineIds = machineIds && machineIds.length > 0 ? machineIds : machineId ? [machineId] : []

    // Get existing appointments for the date
    const existingAppointments = this.getExistingAppointments(date, laboratoryId, targetMachineIds)

    // Get preferred hours for the laboratory
    const preferredHours = this.getPreferredHours(laboratoryId, date.getDay())

    // Get machine information
    const machines = mockMachines.filter((m) => targetMachineIds.includes(m.id))
    const laboratory = mockLaboratories.find((l) => l.id === laboratoryId)

    // Generate time slots
    const timeSlots = this.generateTimeSlots(
      date,
      laboratoryId,
      targetMachineIds,
      duration,
      existingAppointments,
      preferredHours,
      machines,
    )

    // Calculate total day consumption
    const totalDayConsumption = this.calculateTotalDayConsumption(existingAppointments, timeSlots)

    // Identify peak hours
    const peakHours = this.identifyPeakHours(timeSlots)

    // Generate recommendations
    const recommendations = this.generateRecommendations(timeSlots, date, laboratoryId)

    // Group time slots by efficiency levels
    const efficiencyGroups = this.groupSlotsByEfficiency(timeSlots)

    return {
      timeSlots,
      recommendations,
      totalDayConsumption,
      peakHours,
      efficiencyGroups,
    }
  }

  /**
   * Get existing appointments for a specific date and filters
   */
  private static getExistingAppointments(date: Date, laboratoryId: string, machineIds: string[]): Appointment[] {
    return mockAppointments.filter((appointment) => {
      const appointmentDate = new Date(appointment.appointment_date)
      const sameDate = appointmentDate.toDateString() === date.toDateString()
      const sameLab = appointment.laboratory_id === laboratoryId
      const machineConflict = machineIds.includes(appointment.machine_id)
      const notCancelled = appointment.status !== "cancelled"

      return sameDate && sameLab && machineConflict && notCancelled
    })
  }

  /**
   * Get preferred hours for a laboratory on a specific day
   */
  private static getPreferredHours(laboratoryId: string, dayOfWeek: number): PreferredHour[] {
    // Get all preferred hours for the building (not filtered by laboratory_id)
    return mockPreferredHours.filter((pref) => pref.day_of_week === dayOfWeek)
  }

  /**
   * Generate available time slots with power consumption calculations
   */
  private static generateTimeSlots(
    date: Date,
    laboratoryId: string,
    machineIds: string[],
    duration: number,
    existingAppointments: Appointment[],
    preferredHours: PreferredHour[],
    machines: Machine[],
  ): TimeSlot[] {
    const timeSlots: TimeSlot[] = []
    const totalMachinePower = machines.reduce((sum, machine) => sum + machine.power_consumption, 0)

    const slotIncrementHours = this.SLOT_INCREMENT_MINUTES / 60
    const maxEndHour = this.WORKING_HOURS_END

    for (
      let startHour = this.WORKING_HOURS_START;
      startHour + duration <= maxEndHour;
      startHour += slotIncrementHours
    ) {
      const endHour = startHour + duration
      const startTime = this.formatTime(startHour)
      const endTime = this.formatTime(endHour)

      // Check if slot conflicts with existing appointments
      const hasConflict = existingAppointments.some((appointment) =>
        this.timeSlotsOverlap(startTime, endTime, appointment.start_time, appointment.end_time),
      )

      const overlappingPreferredHours = preferredHours.filter(
        (pref) =>
          this.timeWithinRange(startTime, endTime, pref.start_time, pref.end_time) ||
          this.timeSlotsOverlap(startTime, endTime, pref.start_time, pref.end_time),
      )

      // Calculate power consumption
      let powerConsumption = totalMachinePower

      if (overlappingPreferredHours.length > 0) {
        // Calculate average consumption from overlapping preferred hours
        const averagePreferredConsumption =
          overlappingPreferredHours.reduce((sum, pref) => sum + pref.power_consumption, 0) /
          overlappingPreferredHours.length
        powerConsumption += averagePreferredConsumption
      } else {
        // Higher base consumption during non-preferred hours
        powerConsumption += this.calculateNonPreferredHourConsumption(startHour)
      }

      // Add environmental factors
      //powerConsumption += this.calculateEnvironmentalFactors(date, startHour)

      // Determine availability reason
      let reason: string | undefined
      if (hasConflict) {
        reason = "Horario ya reservado"
      } else if (powerConsumption > this.PEAK_CONSUMPTION_THRESHOLD) {
        reason = `Alto consumo energético (${powerConsumption.toFixed(1)} kW)`
      }

      timeSlots.push({
        start_time: startTime,
        end_time: endTime,
        available: !hasConflict,
        power_consumption: powerConsumption,
        power_spike_percentage: 0, // Will be calculated after sorting
        machine_ids: machineIds,
        reason,
      })
    }

    const sortedSlots = timeSlots.sort((a, b) => {
      if (a.power_consumption !== b.power_consumption) {
        return a.power_consumption - b.power_consumption
      }
      // Sort by time (most recent to latest means earlier times first)
      return a.start_time.localeCompare(b.start_time)
    })

    // Calculate power spike percentages based on the lowest consumption
    const lowestPower = sortedSlots.length > 0 ? sortedSlots[0].power_consumption : 0
    return sortedSlots.map((slot) => ({
      ...slot,
      power_spike_percentage: lowestPower > 0 ? ((slot.power_consumption - lowestPower) / lowestPower) * 100 : 0,
    }))
  }

  /**
   * Check if two time ranges overlap
   */
  private static timeSlotsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const start1Minutes = this.timeToMinutes(start1)
    const end1Minutes = this.timeToMinutes(end1)
    const start2Minutes = this.timeToMinutes(start2)
    const end2Minutes = this.timeToMinutes(end2)

    return start1Minutes < end2Minutes && end1Minutes > start2Minutes
  }

  /**
   * Check if a time slot is within a preferred time range
   */
  private static timeWithinRange(slotStart: string, slotEnd: string, rangeStart: string, rangeEnd: string): boolean {
    const slotStartMinutes = this.timeToMinutes(slotStart)
    const slotEndMinutes = this.timeToMinutes(slotEnd)
    const rangeStartMinutes = this.timeToMinutes(rangeStart)
    const rangeEndMinutes = this.timeToMinutes(rangeEnd)

    return slotStartMinutes >= rangeStartMinutes && slotEndMinutes <= rangeEndMinutes
  }

  /**
   * Convert time string to minutes since midnight
   */
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number)
    return hours * 60 + minutes
  }

  /**
   * Calculate power consumption for non-preferred hours
   */
  private static calculateNonPreferredHourConsumption(hour: number): number {
    // Peak hours (10-12, 14-16) have higher consumption
    if ((hour >= 10 && hour < 12) || (hour >= 14 && hour < 16)) {
      return 2.5 // High consumption
    } else if (hour >= 8 && hour < 10) {
      return 1.5 // Medium consumption (morning)
    } else {
      return 2.0 // Standard consumption
    }
  }

  /**
   * Calculate environmental factors affecting power consumption
   */
  private static calculateEnvironmentalFactors(date: Date, hour: number): number {
    let factor = 0

    // Weekend has lower base consumption
    if (date.getDay() === 0 || date.getDay() === 6) {
      factor -= 0.3
    }

    // Summer months (June-August) have higher cooling costs
    const month = date.getMonth()
    if (month >= 5 && month <= 7) {
      factor += 0.5
    }

    // Afternoon hours have higher cooling/heating needs
    if (hour >= 12 && hour <= 16) {
      factor += 0.3
    }

    return Math.max(0, factor) // Ensure non-negative
  }

  /**
   * Calculate total power consumption for the day
   */
  private static calculateTotalDayConsumption(existingAppointments: Appointment[], availableSlots: TimeSlot[]): number {
    const existingConsumption = existingAppointments.reduce(
      (total, appointment) => total + appointment.power_consumption,
      0,
    )

    // Add estimated consumption from available slots that might be booked
    const potentialConsumption =
      availableSlots.filter((slot) => slot.available).reduce((total, slot) => total + slot.power_consumption, 0) * 0.3 // 30% booking probability

    return existingConsumption + potentialConsumption
  }

  /**
   * Identify peak consumption hours
   */
  private static identifyPeakHours(timeSlots: TimeSlot[]): string[] {
    return timeSlots
      .filter((slot) => slot.power_consumption > this.PEAK_CONSUMPTION_THRESHOLD)
      .map((slot) => `${slot.start_time}-${slot.end_time}`)
  }

  /**
   * Generate recommendations for optimal booking
   */
  private static generateRecommendations(
    timeSlots: TimeSlot[],
    date: Date,
    laboratoryId: string,
  ): AvailabilityResult["recommendations"] {
    const availableSlots = timeSlots.filter((slot) => slot.available)

    // Find the most energy-efficient slots
    const energyEfficientSlots = availableSlots
      .filter((slot) => slot.power_consumption <= 3.0)
      .sort((a, b) => a.power_consumption - b.power_consumption)
      .slice(0, 3)

    // Find the best overall slot (balance of availability and efficiency)
    const bestSlot = availableSlots.sort((a, b) => {
      // Prioritize lower power consumption and earlier times
      const powerDiff = a.power_consumption - b.power_consumption
      if (Math.abs(powerDiff) > 0.5) return powerDiff

      const timeA = this.timeToMinutes(a.start_time)
      const timeB = this.timeToMinutes(b.start_time)
      return timeA - timeB
    })[0]

    // Generate alternative dates if current date has limited availability
    const alternativeDates = availableSlots.length < 3 ? this.generateAlternativeDates(date, laboratoryId) : undefined

    return {
      bestSlot,
      energyEfficientSlots,
      alternativeDates,
    }
  }

  /**
   * Generate alternative dates with better availability
   */
  private static generateAlternativeDates(date: Date, laboratoryId: string): Date[] {
    const alternatives: Date[] = []
    const currentDate = new Date(date)

    // Check next 7 days
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(currentDate)
      nextDate.setDate(currentDate.getDate() + i)

      // Skip weekends for now (can be made configurable)
      if (nextDate.getDay() !== 0 && nextDate.getDay() !== 6) {
        alternatives.push(nextDate)
      }
    }

    return alternatives.slice(0, 3) // Return top 3 alternatives
  }

  /**
   * Get optimal time slots for a specific machine across multiple days
   */
  static async getOptimalSlots(
    laboratoryId: string,
    machineId: string,
    startDate: Date,
    days = 7,
  ): Promise<{ date: Date; slots: TimeSlot[] }[]> {
    const results: { date: Date; slots: TimeSlot[] }[] = []

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)

      const availability = await this.checkAvailability({
        date,
        laboratoryId,
        machineId,
      })

      const optimalSlots = availability.timeSlots
        .filter((slot) => slot.available && slot.power_consumption <= 3.0)
        .sort((a, b) => a.power_consumption - b.power_consumption)
        .slice(0, 2)

      if (optimalSlots.length > 0) {
        results.push({ date, slots: optimalSlots })
      }
    }

    return results
  }

  /**
   * Format hour as HH:MM string
   */
  private static formatTime(hour: number): string {
    const hours = Math.floor(hour)
    const minutes = Math.round((hour - hours) * 60)
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
  }

  static groupSlotsByEfficiency(timeSlots: TimeSlot[]): EfficiencyGroup[] {
    if (timeSlots.length === 0) return []

    // Sort slots by power consumption first
    const sortedSlots = [...timeSlots].sort((a, b) => {
      if (a.power_consumption !== b.power_consumption) {
        return a.power_consumption - b.power_consumption
      }
      return a.start_time.localeCompare(b.start_time)
    })

    // Define efficiency thresholds
    const groups: EfficiencyGroup[] = []
    const lowestPower = sortedSlots[0]?.power_consumption || 0

    // Group slots by power spike percentage ranges
    const ranges = [
      { max: 5, label: "Óptimo", id: "optimal" },
      { max: 15, label: "Bueno", id: "good" },
      { max: 30, label: "Regular", id: "regular" },
      { max: 50, label: "Alto", id: "high" },
      { max: Number.POSITIVE_INFINITY, label: "Muy Alto", id: "very-high" },
    ]

    ranges.forEach((range) => {
      const rangeSlots = sortedSlots.filter((slot) => {
        const percentage = lowestPower > 0 ? ((slot.power_consumption - lowestPower) / lowestPower) * 100 : 0
        const prevMax = ranges[ranges.indexOf(range) - 1]?.max || 0
        return percentage >= prevMax && percentage < range.max
      })

      if (rangeSlots.length > 0) {
        const firstSlot = rangeSlots[0]
        const lastSlot = rangeSlots[rangeSlots.length - 1]
        const avgPower = rangeSlots.reduce((sum, slot) => sum + slot.power_consumption, 0) / rangeSlots.length
        const avgPercentage = lowestPower > 0 ? ((avgPower - lowestPower) / lowestPower) * 100 : 0

        groups.push({
          id: range.id,
          label: range.label,
          power_spike_percentage: Math.round(avgPercentage),
          time_range: `${firstSlot.start_time} - ${lastSlot.end_time}`,
          slots: rangeSlots,
          average_power_consumption: avgPower,
        })
      }
    })

    return groups
  }
}
