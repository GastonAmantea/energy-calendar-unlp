// app/api/availability/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { AvailabilityService } from '@/app/services/AvailabilityService';

function parseDateOnly(input: string): Date {
  // Accepts "YYYY-MM-DD" or ISO; normalizes to midnight local time
  if (!input) throw new Error('Fecha inválida');
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(`${input}T00:00:00`);
  const d = new Date(input);
  if (isNaN(d.getTime())) throw new Error('Fecha inválida');
  return d;
}

function parseMachineIds(params: URLSearchParams): number[] {
  // Support both: machine_ids=1,2,3 AND repeated machine_id=1&machine_id=2
  const values: string[] = [
    ...params.getAll('machine_id'),
    ...params.getAll('machine_ids'),
  ];

  const pieces =
    values.length === 1 && values[0]?.includes(',')
      ? values[0].split(',')
      : values;

  const ids = pieces
    .map((v) => Number(v?.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  // dedupe
  return Array.from(new Set(ids));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const dateStr = searchParams.get('date');
    const labStr = searchParams.get('laboratory_id');
    const machineIds = parseMachineIds(searchParams);
    const durationStr = searchParams.get('duration');
    const detailed = searchParams.get('detailed') === 'true';

    if (!dateStr || !labStr) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: date, laboratory_id' },
        { status: 400 }
      );
    }

    if (machineIds.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos una máquina (machine_ids o machine_id)' },
        { status: 400 }
      );
    }

    const laboratoryId = Number(labStr);
    if (!Number.isInteger(laboratoryId) || laboratoryId <= 0) {
      return NextResponse.json(
        { error: 'laboratory_id inválido' },
        { status: 400 }
      );
    }

    // Default 30 minutes if not provided
    const durationMinutes = durationStr ? Number.parseInt(durationStr, 10) : 30;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json(
        { error: 'duration inválida (minutos > 0)' },
        { status: 400 }
      );
    }

    const targetDate = parseDateOnly(dateStr);
    const durationHours = durationMinutes / 60;

    const availabilityResult = await AvailabilityService.checkAvailability({
      date: targetDate,
      laboratoryId,
      machineIds,
      duration: durationHours,
      // if your service accepts it, you can also pass `detailed`
    });

    // If you want to slim the response when detailed=false, tweak here.
    const { efficiencyGroups, timeSlots, recommendations, totalDayConsumption, peakHours } = availabilityResult;

    return NextResponse.json(
      {
        data: {
          efficiencyGroups,
          timeSlots,
          recommendations,
          totalDayConsumption,
          peakHours,
        },
        meta: {
          date: dateStr,
          laboratory_id: laboratoryId,
          machine_ids: machineIds,
          duration_minutes: durationMinutes,
          detailed,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error checking availability:', error);
    return NextResponse.json(
      { error: 'Error al verificar disponibilidad' },
      { status: 500 }
    );
  }
}
