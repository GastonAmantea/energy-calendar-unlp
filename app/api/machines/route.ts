// app/api/machines/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { MachineService } from '@/app/services/MachineService'; // adjust path if needed
const service = new MachineService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const labParam = searchParams.get('laboratory_id');

    if (labParam !== null) {
      const laboratory_id = Number(labParam);
      if (!Number.isInteger(laboratory_id) || laboratory_id <= 0) {
        return NextResponse.json(
          { error: 'laboratory_id inválido' },
          { status: 400 }
        );
      }
      const data = await service.getAllByLaboratory(laboratory_id);
      return NextResponse.json({ data, meta: { laboratory_id } }, { status: 200 });
    }

    const data = await service.getAll();
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error al obtener máquinas' },
      { status: 500 }
    );
  }
}
