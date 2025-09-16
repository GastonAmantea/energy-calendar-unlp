// Database schema types for the energy consumption calendar system

export interface PreferredHour {
  id: string
  day_of_week: number // 0-6 (Sunday to Saturday)
  start_time: string // HH:MM format
  end_time: string // HH:MM format
  power_consumption: number // in kW
  created_at: Date
}

export interface Machine {
  id: string
  name: string
  laboratory_id: string
  power_consumption: number // in kW
  created_at: Date
}

export interface Laboratory {
  id: string
  name: string
  location: string
  created_at: Date
}

export interface Appointment {
  id: string
  laboratory_id: string
  user_name: string
  user_email: string
  appointment_date: Date
  start_time: string // HH:MM format
  end_time: string // HH:MM format
  purpose: string
  status: "pending" | "confirmed" | "cancelled"
  power_consumption: number // calculated total consumption
  created_at: Date
}

export interface AppointmentMachine {
  appointment_id: string
  laboratory_id: string
  machine_id: string
  created_at: Date
}

export interface AppointmentFormData {
  laboratory_id: string
  machine_ids: string[] // Changed from machine_id to support multiple machines
  duration_minutes: number // Added duration in minutes (30, 60, 90, etc.)
  user_name: string
  user_email: string
  appointment_date: string
  start_time: string
  end_time: string
  purpose: string
}

export interface TimeSlot {
  start_time: string
  end_time: string
  available: boolean
  power_consumption: number
  power_spike_percentage: number // Percentage increase from the lowest option
  machine_ids: string[] // Which machines are being used
  reason?: string // why it's not available
}

export interface EfficiencyGroup {
  id: string
  label: string // "Óptimo", "Bueno", etc.
  power_spike_percentage: number
  time_range: string // "8:00 - 13:30"
  slots: TimeSlot[]
  average_power_consumption: number
}

export interface GroupedAvailabilityResult {
  efficiency_groups: EfficiencyGroup[]
  total_slots: number
}
