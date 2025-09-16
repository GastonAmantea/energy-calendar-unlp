"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingDown, Zap, Target, BarChart3, Lightbulb, Clock, Battery, Leaf, AlertTriangle } from "lucide-react"

interface PowerOptimizationDashboardProps {
  laboratoryId: string
  selectedDate: string
  duration: number
}

interface OptimizationResult {
  recommendedSlots: Array<{
    start_time: string
    end_time: string
    power_consumption: number
  }>
  powerSavings: number
  efficiencyScore: number
  optimizationStrategies: string[]
  alternativeSchedules: Array<{
    schedule: Array<{
      start_time: string
      end_time: string
      power_consumption: number
    }>
    totalPower: number
    description: string
  }>
}

interface EnergyProfile {
  hourlyConsumption: Array<{ hour: number; consumption: number }>
  peakHours: number[]
  optimalHours: number[]
  totalDayConsumption: number
  capacityUtilization: number
}

export default function PowerOptimizationDashboard({
  laboratoryId,
  selectedDate,
  duration,
}: PowerOptimizationDashboardProps) {
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null)
  const [energyProfile, setEnergyProfile] = useState<EnergyProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (laboratoryId && selectedDate) {
      fetchOptimizationData()
    }
  }, [laboratoryId, selectedDate, duration])

  const fetchOptimizationData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch optimization results
      const optimizationResponse = await fetch(
        `/api/power-optimization?laboratory_id=${laboratoryId}&date=${selectedDate}&duration=${duration}&prioritize_efficiency=true`,
      )

      if (!optimizationResponse.ok) {
        throw new Error("Error al obtener optimización")
      }

      const optimizationData = await optimizationResponse.json()
      setOptimization(optimizationData)

      // Fetch energy profile
      const profileResponse = await fetch(`/api/energy-profile?laboratory_id=${laboratoryId}&date=${selectedDate}`)

      if (!profileResponse.ok) {
        throw new Error("Error al obtener perfil energético")
      }

      const profileData = await profileResponse.json()
      setEnergyProfile(profileData)
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
            <span className="ml-2">Optimizando consumo energético...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!optimization || !energyProfile) {
    return null
  }

  const getEfficiencyColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getEfficiencyIcon = (score: number) => {
    if (score >= 80) return <Leaf className="h-4 w-4 text-green-600" />
    if (score >= 60) return <Battery className="h-4 w-4 text-yellow-600" />
    return <AlertTriangle className="h-4 w-4 text-red-600" />
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ahorro Energético</p>
                <p className="text-2xl font-bold text-green-600">{optimization.powerSavings.toFixed(1)} kW</p>
              </div>
              <TrendingDown className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Puntuación de Eficiencia</p>
                <p className={`text-2xl font-bold ${getEfficiencyColor(optimization.efficiencyScore)}`}>
                  {optimization.efficiencyScore.toFixed(0)}%
                </p>
              </div>
              {getEfficiencyIcon(optimization.efficiencyScore)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Consumo Total del Día</p>
                <p className="text-2xl font-bold">{energyProfile.totalDayConsumption.toFixed(1)} kW</p>
              </div>
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Utilización de Capacidad</p>
                <p className="text-2xl font-bold">{energyProfile.capacityUtilization.toFixed(0)}%</p>
              </div>
              <Target className="h-8 w-8 text-secondary" />
            </div>
            <Progress value={energyProfile.capacityUtilization} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recommendations">Recomendaciones</TabsTrigger>
          <TabsTrigger value="alternatives">Alternativas</TabsTrigger>
          <TabsTrigger value="insights">Análisis</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Horarios Recomendados
              </CardTitle>
              <CardDescription>Selecciones optimizadas para máxima eficiencia energética</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {optimization.recommendedSlots.map((slot, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-semibold">
                        {slot.start_time} - {slot.end_time}
                      </p>
                      <p className="text-sm text-muted-foreground">Horario optimizado #{index + 1}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-secondary" />
                    <Badge variant="secondary">{slot.power_consumption.toFixed(1)} kW</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estrategias de Optimización Aplicadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {optimization.optimizationStrategies.map((strategy, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-sm">{strategy}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alternatives" className="space-y-4">
          {optimization.alternativeSchedules.map((alternative, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">{alternative.description}</CardTitle>
                <CardDescription>Consumo total: {alternative.totalPower.toFixed(1)} kW</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {alternative.schedule.map((slot, slotIndex) => (
                    <div key={slotIndex} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {slot.start_time} - {slot.end_time}
                        </p>
                      </div>
                      <Badge variant="outline">{slot.power_consumption.toFixed(1)} kW</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Horarios de Pico</CardTitle>
                <CardDescription>Horas con mayor consumo energético</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {energyProfile.peakHours.map((hour) => (
                    <Badge key={hour} variant="destructive">
                      {hour.toString().padStart(2, "0")}:00
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Horarios Óptimos</CardTitle>
                <CardDescription>Horas con menor consumo energético</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {energyProfile.optimalHours.map((hour) => (
                    <Badge key={hour} variant="secondary">
                      {hour.toString().padStart(2, "0")}:00
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Consumo por Hora</CardTitle>
              <CardDescription>Distribución del consumo energético durante el día</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {energyProfile.hourlyConsumption
                  .filter((h) => h.hour >= 8 && h.hour <= 18)
                  .map((hourData) => (
                    <div key={hourData.hour} className="flex items-center gap-4">
                      <span className="text-sm font-mono w-12">{hourData.hour.toString().padStart(2, "0")}:00</span>
                      <div className="flex-1">
                        <Progress value={(hourData.consumption / 10) * 100} className="h-2" />
                      </div>
                      <span className="text-sm w-16 text-right">{hourData.consumption.toFixed(1)} kW</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
