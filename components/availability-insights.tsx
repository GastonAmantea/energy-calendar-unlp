"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TrendingUp, TrendingDown, Zap, Calendar, Lightbulb, BarChart3 } from "lucide-react"

interface AvailabilityInsightsProps {
  laboratoryId: string
  machineId: string
  selectedDate: string
}

interface AvailabilityResult {
  timeSlots: Array<{
    start_time: string
    end_time: string
    available: boolean
    power_consumption: number
    reason?: string
  }>
  recommendations: {
    bestSlot?: {
      start_time: string
      end_time: string
      power_consumption: number
    }
    energyEfficientSlots: Array<{
      start_time: string
      end_time: string
      power_consumption: number
    }>
    alternativeDates?: Date[]
  }
  totalDayConsumption: number
  peakHours: string[]
}

export default function AvailabilityInsights({ laboratoryId, machineId, selectedDate }: AvailabilityInsightsProps) {
  const [insights, setInsights] = useState<AvailabilityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (laboratoryId && machineId && selectedDate) {
      fetchInsights()
    }
  }, [laboratoryId, machineId, selectedDate])

  const fetchInsights = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/availability?date=${selectedDate}&laboratory_id=${laboratoryId}&machine_id=${machineId}&detailed=true`,
      )

      if (!response.ok) {
        throw new Error("Error al obtener análisis de disponibilidad")
      }

      const data = await response.json()
      setInsights(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Analizando disponibilidad...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert className="border-destructive">
        <AlertDescription className="text-destructive">{error}</AlertDescription>
      </Alert>
    )
  }

  if (!insights) {
    return null
  }

  const availableSlots = insights.timeSlots.filter((slot) => slot.available)
  const averageConsumption =
    availableSlots.length > 0
      ? availableSlots.reduce((sum, slot) => sum + slot.power_consumption, 0) / availableSlots.length
      : 0

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horarios Disponibles</p>
                <p className="text-2xl font-bold">{availableSlots.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Consumo Promedio</p>
                <p className="text-2xl font-bold">{averageConsumption.toFixed(1)} kW</p>
              </div>
              <Zap className="h-8 w-8 text-secondary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Consumo Total del Día</p>
                <p className="text-2xl font-bold">{insights.totalDayConsumption.toFixed(1)} kW</p>
              </div>
              <BarChart3 className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {insights.recommendations.bestSlot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Recomendación Principal
            </CardTitle>
            <CardDescription>El horario más eficiente para tu reserva</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
              <div>
                <p className="font-semibold">
                  {insights.recommendations.bestSlot.start_time} - {insights.recommendations.bestSlot.end_time}
                </p>
                <p className="text-sm text-muted-foreground">Horario óptimo con menor consumo energético</p>
              </div>
              <Badge variant="secondary">{insights.recommendations.bestSlot.power_consumption.toFixed(1)} kW</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Energy Efficient Slots */}
      {insights.recommendations.energyEfficientSlots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-secondary" />
              Horarios Eficientes
            </CardTitle>
            <CardDescription>Opciones con menor consumo energético</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.recommendations.energyEfficientSlots.map((slot, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {slot.start_time} - {slot.end_time}
                    </p>
                    <p className="text-sm text-muted-foreground">Bajo consumo</p>
                  </div>
                  <Badge variant="outline" className="text-secondary">
                    {slot.power_consumption.toFixed(1)} kW
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Peak Hours Warning */}
      {insights.peakHours.length > 0 && (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertDescription>
            <strong>Horarios de alto consumo:</strong> {insights.peakHours.join(", ")}
            <br />
            Considera reservar en horarios de menor consumo para optimizar el uso energético.
          </AlertDescription>
        </Alert>
      )}

      {/* Alternative Dates */}
      {insights.recommendations.alternativeDates && insights.recommendations.alternativeDates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent" />
              Fechas Alternativas
            </CardTitle>
            <CardDescription>Otras fechas con mejor disponibilidad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {insights.recommendations.alternativeDates.map((date, index) => (
                <Badge key={index} variant="outline">
                  {new Date(date).toLocaleDateString("es-ES", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
