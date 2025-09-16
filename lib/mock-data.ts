// Mock data for the energy consumption calendar system
import type { Laboratory, Machine, PreferredHour, Appointment } from "./types"

export const mockLaboratories: Laboratory[] = [
  {
    id: "lab-1",
    name: "Laboratorio de Física",
    location: "Edificio A - Planta 2",
    created_at: new Date("2024-01-01"),
  },
  {
    id: "lab-2",
    name: "Laboratorio de Química",
    location: "Edificio B - Planta 1",
    created_at: new Date("2024-01-01"),
  },
  {
    id: "lab-3",
    name: "Laboratorio de Informática",
    location: "Edificio C - Planta 3",
    created_at: new Date("2024-01-01"),
  },
]

export const mockMachines: Machine[] = [
  // Laboratorio de Física
  {
    id: "machine-1",
    name: "Microscopio Electrónico",
    laboratory_id: "lab-1",
    power_consumption: 2.5,
    created_at: new Date("2024-01-01"),
  },
  {
    id: "machine-2",
    name: "Espectrómetro",
    laboratory_id: "lab-1",
    power_consumption: 1.8,
    created_at: new Date("2024-01-01"),
  },
  // Laboratorio de Química
  {
    id: "machine-3",
    name: "Cromatógrafo",
    laboratory_id: "lab-2",
    power_consumption: 3.2,
    created_at: new Date("2024-01-01"),
  },
  {
    id: "machine-4",
    name: "Balanza Analítica",
    laboratory_id: "lab-2",
    power_consumption: 0.5,
    created_at: new Date("2024-01-01"),
  },
  // Laboratorio de Informática
  {
    id: "machine-5",
    name: "Servidor de Cálculo",
    laboratory_id: "lab-3",
    power_consumption: 4.0,
    created_at: new Date("2024-01-01"),
  },
  {
    id: "machine-6",
    name: "Estación de Trabajo",
    laboratory_id: "lab-3",
    power_consumption: 0.8,
    created_at: new Date("2024-01-01"),
  },
]

export const mockPreferredHours: PreferredHour[] = [
  // Monday - Low consumption hours
  {
    id: "pref-1",
    day_of_week: 1,
    start_time: "08:00",
    end_time: "10:00",
    power_consumption: 55.5,
    created_at: new Date("2024-01-01"),
  },
  {
    id: "pref-2",
    day_of_week: 1,
    start_time: "14:00",
    end_time: "16:00",
    power_consumption: 200.5,
    created_at: new Date("2024-01-01"),
  },
  // Tuesday - Medium consumption hours
  {
    id: "pref-3",
    day_of_week: 2,
    start_time: "09:00",
    end_time: "11:00",
    power_consumption: 2.0,
    created_at: new Date("2024-01-01"),
  },
  // Wednesday - High consumption hours
  {
    id: "pref-4",
    day_of_week: 3,
    start_time: "10:00",
    end_time: "12:00",
    power_consumption: 3.5,
    created_at: new Date("2024-01-01"),
  }
]

export const mockAppointments: Appointment[] = [
  {
    id: "app-1",
    laboratory_id: "lab-1",
    machine_id: "machine-1",
    user_name: "María García",
    user_email: "maria.garcia@universidad.edu",
    appointment_date: new Date("2024-12-20"),
    start_time: "09:00",
    end_time: "11:00",
    purpose: "Análisis de muestras biológicas",
    status: "confirmed",
    power_consumption: 2.5,
    created_at: new Date("2024-12-15"),
  },
  {
    id: "app-2",
    laboratory_id: "lab-2",
    machine_id: "machine-3",
    user_name: "Carlos López",
    user_email: "carlos.lopez@universidad.edu",
    appointment_date: new Date("2024-12-21"),
    start_time: "14:00",
    end_time: "16:00",
    purpose: "Separación de compuestos orgánicos",
    status: "pending",
    power_consumption: 3.2,
    created_at: new Date("2024-12-16"),
  },
]
