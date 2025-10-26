// pages/api/send-reservation.ts
import { NextResponse } from "next/server"; // Importar para la nueva estructuraimport nodemailer from "nodemailer"
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  // 1. Obtener el cuerpo (body) de la solicitud
  // En el App Router, el body se lee de la request
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON format" },
      { status: 400 }
    );
  }

  const {
    appointment_date,
    start_time,
    end_time,
    laboratory_name,
    machine_names, // Se espera que sea un array de strings
    user_mail,
    user_name,
    purpose,
  } = body; // Usamos el cuerpo parseado

  // 2. Validación de Entrada
  // Nota: Array.isArray(machine_names) es CRUCIAL y ya lo tienes bien.
  if (
    !appointment_date ||
    !start_time ||
    !end_time ||
    !laboratory_name ||
    !machine_names ||
    !Array.isArray(machine_names) ||
    !user_mail ||
    !user_name ||
    !purpose
  ) {
    return NextResponse.json(
      { error: "Faltan campos requeridos o el formato es incorrecto." },
      { status: 400 }
    );
  }


  // 2. Validación de Entrada (Corregida)
  if (
    !appointment_date ||
    !start_time ||
    !end_time ||
    !laboratory_name ||
    !machine_names ||
    !Array.isArray(machine_names) ||
    !user_mail ||
    !user_name ||
    !purpose
  ) {
    return NextResponse.json({ error: "Faltan campos requeridos." })
  }

  // 3. Configurar Nodemailer Transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com", // Usar variables de entorno
    port: Number(process.env.EMAIL_PORT) || 465,
    secure: true, // true para 465
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  })

  // 4. Generar Plantilla (Basado en tu EmailService)

  // Formatear la fecha como en el EmailService
  const appointmentDate = new Date(appointment_date).toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Crear listas HTML y de texto para las máquinas
  const machinesHtmlList = machine_names
    .map((name: string) => `<li>${name}</li>`)
    .join("")

  const machinesTextList = machine_names
    .map((name: string) => `- ${name}`)
    .join("\n")

  const subject = `Confirmación de Reserva - ${laboratory_name}`

  // HTML Content (adaptado de generateConfirmationTemplate)
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
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>¡Reserva Confirmada!</h1>
        </div>
        <div class="content">
          <p>Estimado/a <strong>${user_name}</strong>,</p>
          <p>Tu reserva ha sido confirmada exitosamente. A continuación encontrarás los detalles:</p>
          
          <div class="details">
            <h3>Detalles de la Reserva</h3>
            <p><strong>Laboratorio:</strong> ${laboratory_name}</p>
            <p><strong>Ubicación:</strong> (La ubicación se especificará en el laboratorio)</p>
            <p><strong>Fecha:</strong> ${appointmentDate}</p>
            <p><strong>Horario:</strong> ${start_time} - ${end_time}</p>
            <p><strong>Propósito:</strong> ${purpose}</p>

            <h4 style="margin-top: 15px; margin-bottom: 5px;">Máquinas/Equipos:</h4>
            <ul>
              ${machinesHtmlList}
            </ul>
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

  // Text Content (adaptado de generateConfirmationTemplate)
  const textContent = `
Confirmación de Reserva - ${laboratory_name}

Estimado/a ${user_name},

Tu reserva ha sido confirmada exitosamente.

DETALLES DE LA RESERVA:
- Laboratorio: ${laboratory_name}
- Ubicación: (La ubicación se especificará en el laboratorio)
- Fecha: ${appointmentDate}
- Horario: ${start_time} - ${end_time}
- Propósito: ${purpose}

MÁQUINAS/EQUIPOS:
${machinesTextList}


Sistema de Reservas de Laboratorio - Universidad
Este es un correo automático, por favor no responder
  `

  // 5. Enviar el Email
  try {
    await transporter.sendMail({
      from: `"Sistema de Reservas" <${
        process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER
      }>`,
      to: user_mail, // Variable correcta
      subject: subject,
      html: htmlContent,
      text: textContent, // Añadir versión de texto
    })

    return NextResponse.json({ message: "Email enviado correctamente." })
  } catch (error) {
    console.error("Error al enviar el email:", error)
    return NextResponse.json({ error: "Error al enviar el email." })
  }
}