import type { Appointment, Laboratory, Machine } from "./types"
import { mockLaboratories, mockMachines } from "./mock-data"

export interface EmailTemplate {
  subject: string
  htmlContent: string
  textContent: string
}

export interface NotificationOptions {
  type: "confirmation" | "reminder" | "cancellation" | "energy_report"
  appointment?: Appointment
  energyData?: {
    totalConsumption: number
    savings: number
    efficiencyScore: number
  }
  reminderHours?: number
}

export class EmailService {
  private static readonly FROM_EMAIL = "laboratorio@universidad.edu"
  private static readonly FROM_NAME = "Sistema de Reservas de Laboratorio"

  /**
   * Send appointment confirmation email
   */
  static async sendAppointmentConfirmation(appointment: Appointment): Promise<boolean> {
    try {
      const laboratory = mockLaboratories.find((lab) => lab.id === appointment.laboratory_id)
      const machine = mockMachines.find((m) => m.id === appointment.machine_id)

      const template = this.generateConfirmationTemplate(appointment, laboratory, machine)

      // In a real application, this would integrate with an email service like SendGrid, Resend, etc.
      console.log("[v0] Sending confirmation email to:", appointment.user_email)
      console.log("[v0] Email subject:", template.subject)
      console.log("[v0] Email content:", template.textContent)

      // Simulate email sending
      await this.simulateEmailSending()

      return true
    } catch (error) {
      console.error("Error sending confirmation email:", error)
      return false
    }
  }

  /**
   * Send appointment reminder email
   */
  static async sendAppointmentReminder(appointment: Appointment, hoursBeforeAppointment: number): Promise<boolean> {
    try {
      const laboratory = mockLaboratories.find((lab) => lab.id === appointment.laboratory_id)
      const machine = mockMachines.find((m) => m.id === appointment.machine_id)

      const template = this.generateReminderTemplate(appointment, laboratory, machine, hoursBeforeAppointment)

      console.log("[v0] Sending reminder email to:", appointment.user_email)
      console.log("[v0] Email subject:", template.subject)
      console.log("[v0] Email content:", template.textContent)

      await this.simulateEmailSending()

      return true
    } catch (error) {
      console.error("Error sending reminder email:", error)
      return false
    }
  }

  /**
   * Send appointment cancellation email
   */
  static async sendAppointmentCancellation(appointment: Appointment, reason?: string): Promise<boolean> {
    try {
      const laboratory = mockLaboratories.find((lab) => lab.id === appointment.laboratory_id)
      const machine = mockMachines.find((m) => m.id === appointment.machine_id)

      const template = this.generateCancellationTemplate(appointment, laboratory, machine, reason)

      console.log("[v0] Sending cancellation email to:", appointment.user_email)
      console.log("[v0] Email subject:", template.subject)
      console.log("[v0] Email content:", template.textContent)

      await this.simulateEmailSending()

      return true
    } catch (error) {
      console.error("Error sending cancellation email:", error)
      return false
    }
  }

  /**
   * Send energy consumption report
   */
  static async sendEnergyReport(
    userEmail: string,
    userName: string,
    energyData: {
      totalConsumption: number
      savings: number
      efficiencyScore: number
      appointments: Appointment[]
    },
  ): Promise<boolean> {
    try {
      const template = this.generateEnergyReportTemplate(userName, energyData)

      console.log("[v0] Sending energy report to:", userEmail)
      console.log("[v0] Email subject:", template.subject)
      console.log("[v0] Email content:", template.textContent)

      await this.simulateEmailSending()

      return true
    } catch (error) {
      console.error("Error sending energy report:", error)
      return false
    }
  }

  /**
   * Generate confirmation email template
   */
  private static generateConfirmationTemplate(
    appointment: Appointment,
    laboratory?: Laboratory,
    machine?: Machine,
  ): EmailTemplate {
    const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    const subject = `Confirmación de Reserva - ${laboratory?.name || "Laboratorio"}`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Confirmación de Reserva</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .energy-info { background-color: #10b981; color: white; padding: 10px; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Reserva Confirmada!</h1>
          </div>
          <div class="content">
            <p>Estimado/a <strong>${appointment.user_name}</strong>,</p>
            <p>Tu reserva ha sido confirmada exitosamente. A continuación encontrarás los detalles:</p>
            
            <div class="details">
              <h3>Detalles de la Reserva</h3>
              <p><strong>Laboratorio:</strong> ${laboratory?.name || "No especificado"}</p>
              <p><strong>Ubicación:</strong> ${laboratory?.location || "No especificada"}</p>
              <p><strong>Máquina/Equipo:</strong> ${machine?.name || "No especificado"}</p>
              <p><strong>Fecha:</strong> ${appointmentDate}</p>
              <p><strong>Horario:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
              <p><strong>Propósito:</strong> ${appointment.purpose}</p>
            </div>

            <div class="energy-info">
              <h3>Información Energética</h3>
              <p><strong>Consumo Estimado:</strong> ${appointment.power_consumption.toFixed(1)} kW</p>
              <p>Esta reserva ha sido optimizada para minimizar el consumo energético.</p>
            </div>

            <p><strong>Importante:</strong></p>
            <ul>
              <li>Por favor, llega 10 minutos antes de tu horario reservado</li>
              <li>Trae tu identificación universitaria</li>
              <li>Si necesitas cancelar, hazlo con al menos 24 horas de anticipación</li>
            </ul>
          </div>
          <div class="footer">
            <p>Sistema de Reservas de Laboratorio - Universidad</p>
            <p>Este es un correo automático, por favor no responder</p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
Confirmación de Reserva - ${laboratory?.name || "Laboratorio"}

Estimado/a ${appointment.user_name},

Tu reserva ha sido confirmada exitosamente.

DETALLES DE LA RESERVA:
- Laboratorio: ${laboratory?.name || "No especificado"}
- Ubicación: ${laboratory?.location || "No especificada"}
- Máquina/Equipo: ${machine?.name || "No especificado"}
- Fecha: ${appointmentDate}
- Horario: ${appointment.start_time} - ${appointment.end_time}
- Propósito: ${appointment.purpose}

INFORMACIÓN ENERGÉTICA:
- Consumo Estimado: ${appointment.power_consumption.toFixed(1)} kW
- Esta reserva ha sido optimizada para minimizar el consumo energético.

IMPORTANTE:
- Por favor, llega 10 minutos antes de tu horario reservado
- Trae tu identificación universitaria
- Si necesitas cancelar, hazlo con al menos 24 horas de anticipación

Sistema de Reservas de Laboratorio - Universidad
Este es un correo automático, por favor no responder
    `

    return { subject, htmlContent, textContent }
  }

  /**
   * Generate reminder email template
   */
  private static generateReminderTemplate(
    appointment: Appointment,
    laboratory?: Laboratory,
    machine?: Machine,
    hoursBeforeAppointment = 24,
  ): EmailTemplate {
    const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    const subject = `Recordatorio: Tu reserva es en ${hoursBeforeAppointment} horas`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Recordatorio de Reserva</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .reminder-box { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Recordatorio de Reserva</h1>
          </div>
          <div class="content">
            <div class="reminder-box">
              <h3>⏰ Tu reserva es en ${hoursBeforeAppointment} horas</h3>
              <p>No olvides tu cita programada para mañana.</p>
            </div>
            
            <p>Hola <strong>${appointment.user_name}</strong>,</p>
            
            <div class="details">
              <h3>Detalles de tu Reserva</h3>
              <p><strong>Laboratorio:</strong> ${laboratory?.name || "No especificado"}</p>
              <p><strong>Máquina/Equipo:</strong> ${machine?.name || "No especificado"}</p>
              <p><strong>Fecha:</strong> ${appointmentDate}</p>
              <p><strong>Horario:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
            </div>

            <p><strong>Preparativos:</strong></p>
            <ul>
              <li>Revisa que tengas todos los materiales necesarios</li>
              <li>Llega 10 minutos antes del horario</li>
              <li>Trae tu identificación universitaria</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
Recordatorio: Tu reserva es en ${hoursBeforeAppointment} horas

Hola ${appointment.user_name},

Tu reserva está programada para:
- Laboratorio: ${laboratory?.name || "No especificado"}
- Máquina/Equipo: ${machine?.name || "No especificado"}
- Fecha: ${appointmentDate}
- Horario: ${appointment.start_time} - ${appointment.end_time}

Preparativos:
- Revisa que tengas todos los materiales necesarios
- Llega 10 minutos antes del horario
- Trae tu identificación universitaria

Sistema de Reservas de Laboratorio - Universidad
    `

    return { subject, htmlContent, textContent }
  }

  /**
   * Generate cancellation email template
   */
  private static generateCancellationTemplate(
    appointment: Appointment,
    laboratory?: Laboratory,
    machine?: Machine,
    reason?: string,
  ): EmailTemplate {
    const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    const subject = `Cancelación de Reserva - ${laboratory?.name || "Laboratorio"}`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Cancelación de Reserva</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ff4d4f; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reserva Cancelada</h1>
          </div>
          <div class="content">
            <p>Estimado/a <strong>${appointment.user_name}</strong>,</p>
            <p>Tu reserva ha sido cancelada.</p>
            
            <div class="details">
              <h3>Detalles de la Reserva Cancelada</h3>
              <p><strong>Laboratorio:</strong> ${laboratory?.name || "No especificado"}</p>
              <p><strong>Máquina/Equipo:</strong> ${machine?.name || "No especificado"}</p>
              <p><strong>Fecha:</strong> ${appointmentDate}</p>
              <p><strong>Horario:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
              ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ""}
            </div>

            <p>Puedes hacer una nueva reserva cuando lo necesites a través de nuestro sistema.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
Cancelación de Reserva - ${laboratory?.name || "Laboratorio"}

Estimado/a ${appointment.user_name},

Tu reserva ha sido cancelada.

DETALLES DE LA RESERVA CANCELADA:
- Laboratorio: ${laboratory?.name || "No especificado"}
- Máquina/Equipo: ${machine?.name || "No especificado"}
- Fecha: ${appointmentDate}
- Horario: ${appointment.start_time} - ${appointment.end_time}
${reason ? `- Motivo: ${reason}` : ""}

Puedes hacer una nueva reserva cuando lo necesites a través de nuestro sistema.

Sistema de Reservas de Laboratorio - Universidad
    `

    return { subject, htmlContent, textContent }
  }

  /**
   * Generate energy report email template
   */
  private static generateEnergyReportTemplate(
    userName: string,
    energyData: {
      totalConsumption: number
      savings: number
      efficiencyScore: number
      appointments: Appointment[]
    },
  ): EmailTemplate {
    const subject = "Reporte de Consumo Energético - Resumen Mensual"

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reporte de Consumo Energético</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat-box { background-color: white; padding: 15px; border-radius: 5px; text-align: center; flex: 1; margin: 0 5px; }
          .appointments { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reporte de Consumo Energético</h1>
            <p>Resumen de tu actividad mensual</p>
          </div>
          <div class="content">
            <p>Hola <strong>${userName}</strong>,</p>
            <p>Aquí tienes tu reporte mensual de consumo energético:</p>
            
            <div class="stats">
              <div class="stat-box">
                <h3>${energyData.totalConsumption.toFixed(1)} kW</h3>
                <p>Consumo Total</p>
              </div>
              <div class="stat-box">
                <h3>${energyData.savings.toFixed(1)} kW</h3>
                <p>Energía Ahorrada</p>
              </div>
              <div class="stat-box">
                <h3>${energyData.efficiencyScore.toFixed(0)}%</h3>
                <p>Puntuación de Eficiencia</p>
              </div>
            </div>

            <div class="appointments">
              <h3>Resumen de Reservas (${energyData.appointments.length} total)</h3>
              ${energyData.appointments
                .slice(0, 5)
                .map(
                  (apt) => `
                <p>• ${new Date(apt.appointment_date).toLocaleDateString("es-ES")} - ${apt.start_time} (${apt.power_consumption.toFixed(1)} kW)</p>
              `,
                )
                .join("")}
              ${energyData.appointments.length > 5 ? "<p>... y más</p>" : ""}
            </div>

            <p><strong>¡Felicitaciones!</strong> Tu uso eficiente de los recursos contribuye a la sostenibilidad de nuestra universidad.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
Reporte de Consumo Energético - Resumen Mensual

Hola ${userName},

Aquí tienes tu reporte mensual de consumo energético:

ESTADÍSTICAS:
- Consumo Total: ${energyData.totalConsumption.toFixed(1)} kW
- Energía Ahorrada: ${energyData.savings.toFixed(1)} kW
- Puntuación de Eficiencia: ${energyData.efficiencyScore.toFixed(0)}%

RESUMEN DE RESERVAS (${energyData.appointments.length} total):
${energyData.appointments
  .slice(0, 5)
  .map(
    (apt) =>
      `- ${new Date(apt.appointment_date).toLocaleDateString("es-ES")} - ${apt.start_time} (${apt.power_consumption.toFixed(1)} kW)`,
  )
  .join("\n")}
${energyData.appointments.length > 5 ? "... y más" : ""}

¡Felicitaciones! Tu uso eficiente de los recursos contribuye a la sostenibilidad de nuestra universidad.

Sistema de Reservas de Laboratorio - Universidad
    `

    return { subject, htmlContent, textContent }
  }

  /**
   * Simulate email sending delay
   */
  private static async simulateEmailSending(): Promise<void> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  /**
   * Schedule reminder emails for upcoming appointments
   */
  static async scheduleReminders(appointments: Appointment[]): Promise<void> {
    const now = new Date()

    for (const appointment of appointments) {
      const appointmentDateTime = new Date(appointment.appointment_date)
      const [hours, minutes] = appointment.start_time.split(":").map(Number)
      appointmentDateTime.setHours(hours, minutes, 0, 0)

      // Schedule 24-hour reminder
      const reminderTime24h = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000)
      if (reminderTime24h > now) {
        console.log(`[v0] Scheduling 24h reminder for appointment ${appointment.id} at ${reminderTime24h}`)
        // In a real application, this would use a job queue or cron job
      }

      // Schedule 2-hour reminder
      const reminderTime2h = new Date(appointmentDateTime.getTime() - 2 * 60 * 60 * 1000)
      if (reminderTime2h > now) {
        console.log(`[v0] Scheduling 2h reminder for appointment ${appointment.id} at ${reminderTime2h}`)
      }
    }
  }
}
