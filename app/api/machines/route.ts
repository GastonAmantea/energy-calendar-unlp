import { NextResponse } from "next/server"
import { mockMachines } from "@/lib/mock-data"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const laboratoryId = searchParams.get("laboratory_id")

    if (laboratoryId) {
      const filteredMachines = mockMachines.filter((machine) => machine.laboratory_id === laboratoryId)
      return NextResponse.json(filteredMachines)
    }

    return NextResponse.json(mockMachines)
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener máquinas" }, { status: 500 })
  }
}
