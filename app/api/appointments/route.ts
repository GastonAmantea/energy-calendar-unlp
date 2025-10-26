// app/api/appointments/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { AppointmentService } from '@/app/services/AppointmentService'; // ← update if needed
import { start } from 'repl';

const service = new AppointmentService();

// Helpers
function parseDateOnly(input: string): Date {
  // Accepts "YYYY-MM-DD" or ISO; normalizes to local midnight
  if (!input) throw new Error('Invalid date');
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(`${input}T00:00:00`);
  const d = new Date(input);
  if (isNaN(d.getTime())) throw new Error('Invalid date');
  return d;
}

function parseTime(input: string): Date {
  // Accepts "HH:mm" or "HH:mm:ss" → store as Date for @db.Time()
  if (!input) throw new Error('Invalid time');
  const m = input.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d;
    throw new Error('Invalid time format');
  }
  const [, hh, mm, ss] = m;
  return new Date(`1970-01-01T${hh}:${mm}:${ss ?? '00'}Z`);
}

// GET /api/appointments?date=YYYY-MM-DD&laboratory_id=1
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;
    const laboratoryId = searchParams.get('laboratory_id');
    const laboratory_id = laboratoryId ? Number(laboratoryId) : undefined;

    const data = await service.getAllBy({ date, laboratory_id });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error al obtener citas' },
      { status: 500 }
    );
  }
}

// POST /api/appointments
// Body example:
// {
//   "laboratory_id": 1,
//   "user_name": "Gastón",
//   "user_email": "gaston@example.com",
//   "appointment_date": "2025-09-20",
//   "start_time": "09:00",
//   "end_time": "11:00",
//   "purpose": "Calibration",
//   "status": "PENDING",
//   "power_consumption": 12.5,
//   "machineIds": [1,2,3]
// }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    body.status = body.status || 'RESERVADO';
    // Basic validation (keep it lightweight; swap to Zod later if you want)
    const required = [
      'laboratory_id',
      'user_name',
      'user_email',
      'appointment_date',
      'start_time',
      'end_time',
      'purpose',
      'status',
    ];
    console.log(body);
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json(
          { error: `Missing field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Normalize types
    const machineIds: number[] | undefined = Array.isArray(body.machine_ids)
      ? body.machine_ids.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
      : undefined;
    const data = {
      laboratory_id: Number(body.laboratory_id),
      user_name: String(body.user_name),
      user_email: String(body.user_email),
      appointment_date: parseDateOnly(String(body.appointment_date)),
      start_time: parseTime(String(body.start_time)),
      end_time: parseTime(String(body.end_time)),
      purpose: String(body.purpose),
      status: String(body.status),
      power_consumption:
        body.power_consumption !== undefined && body.power_consumption !== null
          ? Number(body.power_consumption)
          : undefined,
      // created_at is DB default
    };

    const created = await service.create({ data, machineIds });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    const msg = typeof error?.message === 'string' ? error.message : 'Error al crear la cita';
    const status = /invalid|missing/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
