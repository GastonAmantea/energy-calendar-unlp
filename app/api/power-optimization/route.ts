import { NextResponse } from "next/server"
import { PowerOptimizationService } from "@/lib/power-optimization"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const laboratoryId = searchParams.get("laboratory_id")
    const date = searchParams.get("date")
    const duration = searchParams.get("duration")
    const maxPowerBudget = searchParams.get("max_power_budget")
    const prioritizeEfficiency = searchParams.get("prioritize_efficiency") === "true"

    if (!laboratoryId || !date) {
      return NextResponse.json({ error: "Faltan parámetros requeridos: laboratory_id, date" }, { status: 400 })
    }

    const targetDate = new Date(date)
    const requestedDuration = duration ? Number.parseInt(duration) : 2
    const powerBudget = maxPowerBudget ? Number.parseFloat(maxPowerBudget) : 10

    const optimization = await PowerOptimizationService.optimizeScheduling({
      laboratoryId,
      date: targetDate,
      requestedDuration,
      maxPowerBudget: powerBudget,
      prioritizeEfficiency,
    })

    return NextResponse.json(optimization)
  } catch (error) {
    console.error("Error in power optimization:", error)
    return NextResponse.json({ error: "Error al optimizar consumo energético" }, { status: 500 })
  }
}
