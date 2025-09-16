// app/api/laboratories/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { LaboratoryService } from '@/app/services/LaboratoryService'; // adjust path if needed

const service = new LaboratoryService();

export async function GET(_req: NextRequest) {
  try {
    const data = await service.getAll();
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error al obtener laboratorios' },
      { status: 500 }
    );
  }
}
