import { NextResponse } from "next/server"
import { mockLaboratories } from "@/lib/mock-data"

export async function GET() {
  try {
    return NextResponse.json(mockLaboratories)
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener laboratorios" }, { status: 500 })
  }
}
