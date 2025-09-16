"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, Calendar, Zap, Send, Clock, CheckCircle, XCircle, BarChart3 } from "lucide-react"

interface NotificationCenterProps {
  userEmail?: string
  userName?: string
}

export default function NotificationCenter({
  userEmail = "usuario@universidad.edu",
  userName = "Usuario",
}: NotificationCenterProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const sendTestNotification = async (type: string) => {
    setLoading(true)
    setMessage(null)

    try {
      const payload: any = { type }

      switch (type) {
        case "confirmation":
          payload.appointmentId = "app-1" // Mock appointment ID
          break
        case "reminder":
          payload.appointmentId = "app-1"
          break
        case "cancellation":
          payload.appointmentId = "app-1"
          payload.reason = "Prueba de cancelación del sistema"
          break
        case "energy_report":
          payload.userEmail = userEmail
          payload.userName = userName
          payload.energyData = {
            totalConsumption: 45.2,
            savings: 12.8,
            efficiencyScore: 87,
            appointments: [
              {
                id: "app-1",
                appointment_date: new Date(),
                start_time: "09:00",
                power_consumption: 2.5,
              },
              {
                id: "app-2",
                appointment_date: new Date(Date.now() - 24 * 60 * 60 * 1000),
                start_time: "14:00",
                power_consumption: 3.2,
              },
            ],
          }
          break
      }

      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: "success", text: result.message })
      } else {
        setMessage({ type: "error", text: result.message || "Error al enviar notificación" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error de conexión" })
    } finally {
      setLoading(false)
    }
  }

  const scheduleReminders = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch("/api/notifications/schedule-reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: "success", text: result.message })
      } else {
        setMessage({ type: "error", text: "Error al programar recordatorios" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error de conexión" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Centro de Notificaciones
          </CardTitle>
          <CardDescription>Gestiona las notificaciones por correo electrónico del sistema</CardDescription>
        </CardHeader>
      </Card>

      {message && (
        <Alert className={message.type === "error" ? "border-destructive" : "border-green-500"}>
          <AlertDescription className={message.type === "error" ? "text-destructive" : "text-green-600"}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="test" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="test">Pruebas de Email</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="test" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Confirmation Email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Email de Confirmación
                </CardTitle>
                <CardDescription>Envía un email de confirmación de reserva</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <p>• Detalles de la reserva</p>
                    <p>• Información energética</p>
                    <p>• Instrucciones importantes</p>
                  </div>
                  <Button
                    onClick={() => sendTestNotification("confirmation")}
                    disabled={loading}
                    className="w-full"
                    variant="outline"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Prueba
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Reminder Email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Email de Recordatorio
                </CardTitle>
                <CardDescription>Envía un recordatorio 24h antes de la cita</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <p>• Recordatorio de cita próxima</p>
                    <p>• Detalles de la reserva</p>
                    <p>• Preparativos necesarios</p>
                  </div>
                  <Button
                    onClick={() => sendTestNotification("reminder")}
                    disabled={loading}
                    className="w-full"
                    variant="outline"
                  >
                    <Bell className="mr-2 h-4 w-4" />
                    Enviar Prueba
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Cancellation Email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                  Email de Cancelación
                </CardTitle>
                <CardDescription>Notifica la cancelación de una reserva</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <p>• Confirmación de cancelación</p>
                    <p>• Detalles de la reserva cancelada</p>
                    <p>• Motivo de cancelación</p>
                  </div>
                  <Button
                    onClick={() => sendTestNotification("cancellation")}
                    disabled={loading}
                    className="w-full"
                    variant="outline"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Enviar Prueba
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Energy Report Email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-secondary" />
                  Reporte Energético
                </CardTitle>
                <CardDescription>Envía reporte mensual de consumo energético</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <p>• Estadísticas de consumo</p>
                    <p>• Ahorro energético logrado</p>
                    <p>• Puntuación de eficiencia</p>
                  </div>
                  <Button
                    onClick={() => sendTestNotification("energy_report")}
                    disabled={loading}
                    className="w-full"
                    variant="outline"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Enviar Prueba
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Programación de Recordatorios</CardTitle>
              <CardDescription>Configura recordatorios automáticos para citas próximas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Recordatorios Automáticos</h4>
                  <p className="text-sm text-muted-foreground">Programa recordatorios para los próximos 7 días</p>
                </div>
                <Button onClick={scheduleReminders} disabled={loading} variant="outline">
                  <Calendar className="mr-2 h-4 w-4" />
                  Programar Recordatorios
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Configuración Actual</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Recordatorio 24h:</span>
                      <Badge variant="secondary">Activo</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Recordatorio 2h:</span>
                      <Badge variant="secondary">Activo</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Reporte mensual:</span>
                      <Badge variant="secondary">Activo</Badge>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Estadísticas</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Emails enviados hoy:</span>
                      <span className="font-medium">12</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tasa de entrega:</span>
                      <span className="font-medium text-green-600">98.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recordatorios pendientes:</span>
                      <span className="font-medium">5</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
