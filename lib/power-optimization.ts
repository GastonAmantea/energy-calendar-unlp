import type { TimeSlot } from "./types"
import { mockMachines, mockPreferredHours, mockAppointments } from "./mock-data"

export interface PowerOptimizationOptions {
  laboratoryId: string
  date: Date
  requestedDuration: number // in hours
  maxPowerBudget?: number // maximum kW allowed
  prioritizeEfficiency?: boolean
  allowFlexibleTiming?: boolean
}

export interface OptimizationResult {
  recommendedSlots: TimeSlot[]
  powerSavings: number // kW saved compared to worst case
  efficiencyScore: number // 0-100 score
  optimizationStrategies: string[]
  alternativeSchedules: {
    schedule: TimeSlot[]
    totalPower: number
    description: string
  }[]
}

export interface EnergyProfile {
  laboratoryId: string
  date: Date
  hourlyConsumption: { hour: number; consumption: number }[]
  peakHours: number[]
  optimalHours: number[]
  totalDayConsumption: number
  capacityUtilization: number // percentage
}

export class PowerOptimizationService {
  private static readonly MAX_DAILY_CAPACITY = 50 // kW
  private static readonly EFFICIENCY_THRESHOLD = 3.0 // kW per slot
  private static readonly PEAK_HOUR_MULTIPLIER = 1.5
  private static readonly OFF_PEAK_DISCOUNT = 0.8

  /**
   * Optimize power consumption for appointment scheduling
   */
  static async optimizeScheduling(options: PowerOptimizationOptions): Promise<OptimizationResult> {
    const { laboratoryId, date, requestedDuration, maxPowerBudget = 10, prioritizeEfficiency = true } = options

    // Get current energy profile for the day
    const energyProfile = await this.generateEnergyProfile(laboratoryId, date)

    // Generate all possible time slots
    const allSlots = this.generateAllPossibleSlots(date, requestedDuration)

    // Calculate power consumption for each slot
    const slotsWithPower = await this.calculateSlotPowerConsumption(allSlots, laboratoryId, energyProfile)

    // Apply optimization algorithms
    const optimizedSlots = this.applyOptimizationStrategies(
      slotsWithPower,
      maxPowerBudget,
      prioritizeEfficiency,
      energyProfile,
    )

    // Calculate power savings
    const worstCaseConsumption = Math.max(...slotsWithPower.map((s) => s.power_consumption))
    const bestCaseConsumption = Math.min(...optimizedSlots.map((s) => s.power_consumption))
    const powerSavings = worstCaseConsumption - bestCaseConsumption

    // Calculate efficiency score
    const efficiencyScore = this.calculateEfficiencyScore(optimizedSlots, energyProfile)

    // Generate optimization strategies used
    const strategies = this.getOptimizationStrategies(optimizedSlots, energyProfile)

    // Generate alternative schedules
    const alternativeSchedules = this.generateAlternativeSchedules(slotsWithPower, maxPowerBudget)

    return {
      recommendedSlots: optimizedSlots,
      powerSavings,
      efficiencyScore,
      optimizationStrategies: strategies,
      alternativeSchedules,
    }
  }

  /**
   * Generate energy profile for a laboratory on a specific date
   */
  static async generateEnergyProfile(laboratoryId: string, date: Date): Promise<EnergyProfile> {
    const dayOfWeek = date.getDay()
    const existingAppointments = mockAppointments.filter(
      (apt) =>
        apt.laboratory_id === laboratoryId &&
        new Date(apt.appointment_date).toDateString() === date.toDateString() &&
        apt.status !== "cancelled",
    )

    const preferredHours = mockPreferredHours.filter(
      (pref) => pref.laboratory_id === laboratoryId && pref.day_of_week === dayOfWeek,
    )

    // Calculate hourly consumption
    const hourlyConsumption: { hour: number; consumption: number }[] = []
    let totalDayConsumption = 0

    for (let hour = 0; hour < 24; hour++) {
      let consumption = 0

      // Add base laboratory consumption
      consumption += this.getBaseLaboratoryConsumption(hour)

      // Add consumption from existing appointments
      const hourAppointments = existingAppointments.filter((apt) => {
        const startHour = Number.parseInt(apt.start_time.split(":")[0])
        const endHour = Number.parseInt(apt.end_time.split(":")[0])
        return hour >= startHour && hour < endHour
      })

      consumption += hourAppointments.reduce((sum, apt) => sum + apt.power_consumption, 0)

      // Add preferred hour adjustments
      const isPreferredHour = preferredHours.some((pref) => {
        const startHour = Number.parseInt(pref.start_time.split(":")[0])
        const endHour = Number.parseInt(pref.end_time.split(":")[0])
        return hour >= startHour && hour < endHour
      })

      if (isPreferredHour) {
        consumption *= this.OFF_PEAK_DISCOUNT
      }

      hourlyConsumption.push({ hour, consumption })
      totalDayConsumption += consumption
    }

    // Identify peak and optimal hours
    const avgConsumption = totalDayConsumption / 24
    const peakHours = hourlyConsumption.filter((h) => h.consumption > avgConsumption * 1.2).map((h) => h.hour)
    const optimalHours = hourlyConsumption.filter((h) => h.consumption < avgConsumption * 0.8).map((h) => h.hour)

    const capacityUtilization = (totalDayConsumption / this.MAX_DAILY_CAPACITY) * 100

    return {
      laboratoryId,
      date,
      hourlyConsumption,
      peakHours,
      optimalHours,
      totalDayConsumption,
      capacityUtilization,
    }
  }

  /**
   * Generate all possible time slots for the requested duration
   */
  private static generateAllPossibleSlots(date: Date, duration: number): TimeSlot[] {
    const slots: TimeSlot[] = []

    for (let hour = 8; hour <= 18 - duration; hour++) {
      const startTime = `${hour.toString().padStart(2, "0")}:00`
      const endTime = `${(hour + duration).toString().padStart(2, "0")}:00`

      slots.push({
        start_time: startTime,
        end_time: endTime,
        available: true, // Will be determined later
        power_consumption: 0, // Will be calculated
      })
    }

    return slots
  }

  /**
   * Calculate power consumption for each time slot
   */
  private static async calculateSlotPowerConsumption(
    slots: TimeSlot[],
    laboratoryId: string,
    energyProfile: EnergyProfile,
  ): Promise<TimeSlot[]> {
    return slots.map((slot) => {
      const startHour = Number.parseInt(slot.start_time.split(":")[0])
      const endHour = Number.parseInt(slot.end_time.split(":")[0])

      let totalConsumption = 0

      // Calculate consumption for each hour in the slot
      for (let hour = startHour; hour < endHour; hour++) {
        const hourlyData = energyProfile.hourlyConsumption.find((h) => h.hour === hour)
        const baseConsumption = hourlyData?.consumption || 0

        // Add machine consumption (estimated average)
        const machineConsumption = this.getAverageMachineConsumption(laboratoryId)

        // Apply peak hour multiplier
        const isPeakHour = energyProfile.peakHours.includes(hour)
        const multiplier = isPeakHour ? this.PEAK_HOUR_MULTIPLIER : 1

        totalConsumption += (baseConsumption + machineConsumption) * multiplier
      }

      return {
        ...slot,
        power_consumption: totalConsumption,
      }
    })
  }

  /**
   * Apply optimization strategies to select best slots
   */
  private static applyOptimizationStrategies(
    slots: TimeSlot[],
    maxPowerBudget: number,
    prioritizeEfficiency: boolean,
    energyProfile: EnergyProfile,
  ): TimeSlot[] {
    let optimizedSlots = [...slots]

    // Filter by power budget
    optimizedSlots = optimizedSlots.filter((slot) => slot.power_consumption <= maxPowerBudget)

    // Sort by optimization criteria
    if (prioritizeEfficiency) {
      // Prioritize lowest power consumption
      optimizedSlots.sort((a, b) => a.power_consumption - b.power_consumption)
    } else {
      // Balance power consumption and preferred timing
      optimizedSlots.sort((a, b) => {
        const aScore = this.calculateSlotScore(a, energyProfile)
        const bScore = this.calculateSlotScore(b, energyProfile)
        return bScore - aScore // Higher score is better
      })
    }

    // Return top 3 recommendations
    return optimizedSlots.slice(0, 3)
  }

  /**
   * Calculate a score for a time slot based on multiple factors
   */
  private static calculateSlotScore(slot: TimeSlot, energyProfile: EnergyProfile): number {
    const startHour = Number.parseInt(slot.start_time.split(":")[0])
    let score = 100 // Base score

    // Penalize high power consumption
    const powerPenalty = (slot.power_consumption / this.EFFICIENCY_THRESHOLD) * 20
    score -= powerPenalty

    // Bonus for optimal hours
    if (energyProfile.optimalHours.includes(startHour)) {
      score += 15
    }

    // Penalty for peak hours
    if (energyProfile.peakHours.includes(startHour)) {
      score -= 25
    }

    // Bonus for morning hours (generally more efficient)
    if (startHour >= 8 && startHour <= 10) {
      score += 10
    }

    return Math.max(0, score)
  }

  /**
   * Calculate efficiency score for the optimization result
   */
  private static calculateEfficiencyScore(slots: TimeSlot[], energyProfile: EnergyProfile): number {
    if (slots.length === 0) return 0

    const avgConsumption = slots.reduce((sum, slot) => sum + slot.power_consumption, 0) / slots.length
    const maxPossibleConsumption = this.EFFICIENCY_THRESHOLD * 2 // Worst case scenario

    // Calculate efficiency as inverse of consumption ratio
    const efficiency = Math.max(0, 100 - (avgConsumption / maxPossibleConsumption) * 100)

    // Bonus for using optimal hours
    const optimalHourBonus =
      slots.filter((slot) => {
        const startHour = Number.parseInt(slot.start_time.split(":")[0])
        return energyProfile.optimalHours.includes(startHour)
      }).length * 10

    return Math.min(100, efficiency + optimalHourBonus)
  }

  /**
   * Get optimization strategies used
   */
  private static getOptimizationStrategies(slots: TimeSlot[], energyProfile: EnergyProfile): string[] {
    const strategies: string[] = []

    const avgConsumption = slots.reduce((sum, slot) => sum + slot.power_consumption, 0) / slots.length

    if (avgConsumption < this.EFFICIENCY_THRESHOLD) {
      strategies.push("Selección de horarios de bajo consumo energético")
    }

    const hasOptimalHours = slots.some((slot) => {
      const startHour = Number.parseInt(slot.start_time.split(":")[0])
      return energyProfile.optimalHours.includes(startHour)
    })

    if (hasOptimalHours) {
      strategies.push("Aprovechamiento de horarios de consumo óptimo")
    }

    const avoidsPeakHours = !slots.some((slot) => {
      const startHour = Number.parseInt(slot.start_time.split(":")[0])
      return energyProfile.peakHours.includes(startHour)
    })

    if (avoidsPeakHours) {
      strategies.push("Evita horarios de pico de consumo")
    }

    if (energyProfile.capacityUtilization < 70) {
      strategies.push("Optimización basada en capacidad disponible")
    }

    return strategies
  }

  /**
   * Generate alternative scheduling options
   */
  private static generateAlternativeSchedules(
    slots: TimeSlot[],
    maxPowerBudget: number,
  ): OptimizationResult["alternativeSchedules"] {
    const alternatives: OptimizationResult["alternativeSchedules"] = []

    // Most energy efficient option
    const efficientSlots = slots
      .filter((slot) => slot.power_consumption <= maxPowerBudget)
      .sort((a, b) => a.power_consumption - b.power_consumption)
      .slice(0, 2)

    if (efficientSlots.length > 0) {
      alternatives.push({
        schedule: efficientSlots,
        totalPower: efficientSlots.reduce((sum, slot) => sum + slot.power_consumption, 0),
        description: "Máxima eficiencia energética",
      })
    }

    // Balanced option (morning preference)
    const morningSlots = slots
      .filter((slot) => {
        const hour = Number.parseInt(slot.start_time.split(":")[0])
        return hour >= 8 && hour <= 12 && slot.power_consumption <= maxPowerBudget
      })
      .sort((a, b) => a.power_consumption - b.power_consumption)
      .slice(0, 2)

    if (morningSlots.length > 0) {
      alternatives.push({
        schedule: morningSlots,
        totalPower: morningSlots.reduce((sum, slot) => sum + slot.power_consumption, 0),
        description: "Horarios matutinos balanceados",
      })
    }

    // Flexible timing option
    const flexibleSlots = slots
      .filter((slot) => slot.power_consumption <= maxPowerBudget * 1.2) // Allow slightly higher consumption
      .sort((a, b) => {
        const aHour = Number.parseInt(a.start_time.split(":")[0])
        const bHour = Number.parseInt(b.start_time.split(":")[0])
        return aHour - bHour // Prefer earlier times
      })
      .slice(0, 3)

    if (flexibleSlots.length > 0) {
      alternatives.push({
        schedule: flexibleSlots,
        totalPower: flexibleSlots.reduce((sum, slot) => sum + slot.power_consumption, 0),
        description: "Horarios flexibles con mayor disponibilidad",
      })
    }

    return alternatives
  }

  /**
   * Get base laboratory consumption for a given hour
   */
  private static getBaseLaboratoryConsumption(hour: number): number {
    // Base consumption varies by hour
    if (hour >= 0 && hour < 6) return 0.5 // Night time, minimal consumption
    if (hour >= 6 && hour < 8) return 1.0 // Early morning
    if (hour >= 8 && hour < 18) return 2.0 // Working hours
    if (hour >= 18 && hour < 22) return 1.5 // Evening
    return 0.8 // Late night
  }

  /**
   * Get average machine consumption for a laboratory
   */
  private static getAverageMachineConsumption(laboratoryId: string): number {
    const labMachines = mockMachines.filter((machine) => machine.laboratory_id === laboratoryId)
    if (labMachines.length === 0) return 2.0 // Default consumption

    const totalConsumption = labMachines.reduce((sum, machine) => sum + machine.power_consumption, 0)
    return totalConsumption / labMachines.length
  }

  /**
   * Get power optimization recommendations for multiple days
   */
  static async getWeeklyOptimization(
    laboratoryId: string,
    startDate: Date,
    duration: number,
  ): Promise<{
    dailyRecommendations: { date: Date; optimization: OptimizationResult }[]
    weeklyInsights: {
      totalPowerSavings: number
      bestDays: Date[]
      averageEfficiency: number
    }
  }> {
    const dailyRecommendations: { date: Date; optimization: OptimizationResult }[] = []
    let totalPowerSavings = 0
    let totalEfficiency = 0

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)

      // Skip weekends for now
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        const optimization = await this.optimizeScheduling({
          laboratoryId,
          date,
          requestedDuration: duration,
          prioritizeEfficiency: true,
        })

        dailyRecommendations.push({ date, optimization })
        totalPowerSavings += optimization.powerSavings
        totalEfficiency += optimization.efficiencyScore
      }
    }

    const averageEfficiency = dailyRecommendations.length > 0 ? totalEfficiency / dailyRecommendations.length : 0

    // Find best days (highest efficiency scores)
    const bestDays = dailyRecommendations
      .sort((a, b) => b.optimization.efficiencyScore - a.optimization.efficiencyScore)
      .slice(0, 3)
      .map((item) => item.date)

    return {
      dailyRecommendations,
      weeklyInsights: {
        totalPowerSavings,
        bestDays,
        averageEfficiency,
      },
    }
  }
}
