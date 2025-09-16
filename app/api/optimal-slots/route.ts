import { NextResponse } from "next/server"
import { AvailabilityService } from "@/lib/availability-service"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const laboratoryId = searchParams.get("laboratory_id")
    const machineId = searchParams.get("machine_id")
    const startDate = searchParams.get("start_date")
    const days = searchParams.get("days")

    if (!laboratoryId || !machineId || !startDate) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos: laboratory_id, machine_id, start_date" },
        { status: 400 },
      )
    }

    const targetStartDate = new Date(startDate)
    const numberOfDays = days ? Number.parseInt(days) : 7

    const optimalSlots = await AvailabilityService.getOptimalSlots(
      laboratoryId,
      machineId,
      targetStartDate,
      numberOfDays,
    )

    return NextResponse.json({
      optimal_slots: optimalSlots,
      analysis: {
        total_days_checked: numberOfDays,
        days_with_availability: optimalSlots.length,
        average_slots_per_day:
          optimalSlots.length > 0
            ? optimalSlots.reduce((sum, day) => sum + day.slots.length, 0) / optimalSlots.length
            : 0,
      },
    })
  } catch (error) {
    console.error("Error getting optimal slots:", error)
    return NextResponse.json({ error: "Error al obtener horarios óptimos" }, { status: 500 })
  }
}
