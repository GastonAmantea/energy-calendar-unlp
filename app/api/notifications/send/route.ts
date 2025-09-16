import { NextResponse } from "next/server"
import { EmailService } from "@/lib/email-service"
import { mockAppointments } from "@/lib/mock-data"

export async function POST(request: Request) {
  try {
    const { type, appointmentId, userEmail, userName, energyData, reason } = await request.json()

    switch (type) {
      case "confirmation": {
        if (!appointmentId) {
          return NextResponse.json({ error: "appointmentId es requerido para confirmación" }, { status: 400 })
        }

        const appointment = mockAppointments.find((apt) => apt.id === appointmentId)
        if (!appointment) {
          return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 })
        }

        const success = await EmailService.sendAppointmentConfirmation(appointment)
        return NextResponse.json({
          success,
          message: success ? "Email de confirmación enviado" : "Error al enviar email",
        })
      }

      case "reminder": {
        if (!appointmentId) {
          return NextResponse.json({ error: "appointmentId es requerido para recordatorio" }, { status: 400 })
        }

        const appointment = mockAppointments.find((apt) => apt.id === appointmentId)
        if (!appointment) {
          return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 })
        }

        const success = await EmailService.sendAppointmentReminder(appointment, 24)
        return NextResponse.json({
          success,
          message: success ? "Recordatorio enviado" : "Error al enviar recordatorio",
        })
      }

      case "cancellation": {
        if (!appointmentId) {
          return NextResponse.json({ error: "appointmentId es requerido para cancelación" }, { status: 400 })
        }

        const appointment = mockAppointments.find((apt) => apt.id === appointmentId)
        if (!appointment) {
          return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 })
        }

        const success = await EmailService.sendAppointmentCancellation(appointment, reason)
        return NextResponse.json({
          success,
          message: success ? "Email de cancelación enviado" : "Error al enviar email",
        })
      }

      case "energy_report": {
        if (!userEmail || !userName || !energyData) {
          return NextResponse.json(
            { error: "userEmail, userName y energyData son requeridos para reporte energético" },
            { status: 400 },
          )
        }

        const success = await EmailService.sendEnergyReport(userEmail, userName, energyData)
        return NextResponse.json({
          success,
          message: success ? "Reporte energético enviado" : "Error al enviar reporte",
        })
      }

      default:
        return NextResponse.json({ error: "Tipo de notificación no válido" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error sending notification:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
