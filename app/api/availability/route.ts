import { NextResponse } from "next/server"
import { AvailabilityService } from "@/lib/availability-service"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")
    const laboratoryId = searchParams.get("laboratory_id")
    const machineIds = searchParams.get("machine_ids")?.split(",") || []
    const durationMinutes = searchParams.get("duration") ? Number.parseInt(searchParams.get("duration")!) : 30
    const detailed = searchParams.get("detailed") === "true"

    if (!date || !laboratoryId) {
      return NextResponse.json({ error: "Faltan parámetros requeridos: date, laboratory_id" }, { status: 400 })
    }

    if (machineIds.length === 0) {
      return NextResponse.json({ error: "Se requiere al menos una máquina" }, { status: 400 })
    }

    const targetDate = new Date(date)
    const durationHours = durationMinutes / 60

    const availabilityResult = await AvailabilityService.checkAvailability({
      date: targetDate,
      laboratoryId,
      machineIds, // Pass multiple machine IDs
      duration: durationHours,
    })

    return NextResponse.json({
      efficiencyGroups: availabilityResult.efficiencyGroups,
      timeSlots: availabilityResult.timeSlots,
      recommendations: availabilityResult.recommendations,
      totalDayConsumption: availabilityResult.totalDayConsumption,
      peakHours: availabilityResult.peakHours,
    })
  } catch (error) {
    console.error("Error checking availability:", error)
    return NextResponse.json({ error: "Error al verificar disponibilidad" }, { status: 500 })
  }
}
