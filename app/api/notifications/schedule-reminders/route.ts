import { NextResponse } from "next/server"
import { EmailService } from "@/lib/email-service"
import { mockAppointments } from "@/lib/mock-data"

export async function POST(request: Request) {
  try {
    const { startDate, endDate } = await request.json()

    // Get appointments in the specified date range
    const start = startDate ? new Date(startDate) : new Date()
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

    const upcomingAppointments = mockAppointments.filter((appointment) => {
      const appointmentDate = new Date(appointment.appointment_date)
      return (
        appointmentDate >= start && appointmentDate <= end && appointment.status === "confirmed" // Only send reminders for confirmed appointments
      )
    })

    console.log(`[v0] Found ${upcomingAppointments.length} upcoming appointments for reminder scheduling`)

    // Schedule reminders
    await EmailService.scheduleReminders(upcomingAppointments)

    return NextResponse.json({
      success: true,
      message: `Recordatorios programados para ${upcomingAppointments.length} citas`,
      appointmentsCount: upcomingAppointments.length,
    })
  } catch (error) {
    console.error("Error scheduling reminders:", error)
    return NextResponse.json({ error: "Error al programar recordatorios" }, { status: 500 })
  }
}
