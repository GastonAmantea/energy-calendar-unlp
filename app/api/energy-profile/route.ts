import { NextResponse } from "next/server"
import { PowerOptimizationService } from "@/lib/power-optimization"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const laboratoryId = searchParams.get("laboratory_id")
    const date = searchParams.get("date")

    if (!laboratoryId || !date) {
      return NextResponse.json({ error: "Faltan parámetros requeridos: laboratory_id, date" }, { status: 400 })
    }

    const targetDate = new Date(date)
    const energyProfile = await PowerOptimizationService.generateEnergyProfile(laboratoryId, targetDate)

    return NextResponse.json(energyProfile)
  } catch (error) {
    console.error("Error generating energy profile:", error)
    return NextResponse.json({ error: "Error al generar perfil energético" }, { status: 500 })
  }
}
