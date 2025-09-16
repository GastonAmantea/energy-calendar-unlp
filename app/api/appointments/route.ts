import { NextResponse } from "next/server"
import { mockAppointments } from "@/lib/mock-data"
import type { AppointmentFormData, Appointment } from "@/lib/types"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")
    const laboratoryId = searchParams.get("laboratory_id")

    let filteredAppointments = mockAppointments

    if (date) {
      const targetDate = new Date(date)
      filteredAppointments = filteredAppointments.filter(
        (appointment) => appointment.appointment_date.toDateString() === targetDate.toDateString(),
      )
    }

    if (laboratoryId) {
      filteredAppointments = filteredAppointments.filter((appointment) => appointment.laboratory_id === laboratoryId)
    }

    return NextResponse.json(filteredAppointments)
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener citas" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const formData: AppointmentFormData = await request.json()

    // Create new appointment
    const newAppointment: Appointment = {
      id: `app-${Date.now()}`,
      laboratory_id: formData.laboratory_id,
      machine_id: formData.machine_id,
      user_name: formData.user_name,
      user_email: formData.user_email,
      appointment_date: new Date(formData.appointment_date),
      start_time: formData.start_time,
      end_time: formData.end_time,
      purpose: formData.purpose,
      status: "pending",
      power_consumption: 0, // Will be calculated
      created_at: new Date(),
    }

    // In a real app, this would be saved to database
    mockAppointments.push(newAppointment)

    return NextResponse.json({ message: "Cita creada exitosamente", appointment: newAppointment }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Error al crear la cita" }, { status: 500 })
  }
}
