import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma'; // the singleton above

export class AppointmentService {
  async getAllBy(options: { date?: string; laboratory_id?: number }) {
    const { date, laboratory_id } = options;

    const where: Prisma.AppointmentWhereInput = {};

    if (date) {
      // interpret `date` as local YYYY-MM-DD
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T23:59:59.999`);
      // Better: use UTC-safe math if your server TZ differs from desired TZ.
      where.appointment_date = { gte: start, lte: end };
    }

    if (laboratory_id !== undefined) {
      where.laboratory_id = laboratory_id;
    }

    return prisma.appointment.findMany({
      where,
      include: { laboratory: true, machines: true },
      orderBy: [{ appointment_date: 'asc' }, { start_time: 'asc' }],
    });
  }

  async getAll() {
    return prisma.appointment.findMany({
      include: { laboratory: true, machines: true },
      orderBy: [{ appointment_date: 'asc' }, { start_time: 'asc' }],
    });
  }

  async getById(id: number) {
    return prisma.appointment.findUnique({
      where: { id },
      include: { laboratory: true, machines: true },
    });
  }

  // Create with optional machineIds to connect
  async create(input: {
    data: Omit<Prisma.AppointmentUncheckedCreateInput, 'id' | 'created_at'>;
    machineIds?: number[];
  }) {
    const { data, machineIds } = input;
    return prisma.appointment.create({
      data: {
        ...data,
        // If you prefer relation-safe input, switch to AppointmentCreateInput and use:
        // laboratory: { connect: { id: data.laboratory_id } },
        ...(machineIds?.length
          ? {
              machines: {
                connect: machineIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: { laboratory: true, machines: true },
    });
  }

  // Update scalars and optionally replace machine connections
  async update(
    id: number,
    input: {
      data: Partial<Omit<Prisma.AppointmentUncheckedUpdateInput, 'id' | 'created_at'>>;
      setMachineIds?: number[]; // if provided, we replace the join rows
      addMachineIds?: number[]; // optionally, add more
      removeMachineIds?: number[]; // optionally, remove some
    },
  ) {
    const { data, setMachineIds, addMachineIds, removeMachineIds } = input;

    // Build relation ops
    const machineOps: Prisma.MachineUpdateManyWithoutAppointmentsNestedInput = {};
    if (setMachineIds) machineOps.set = setMachineIds.map((id) => ({ id }));
    if (addMachineIds?.length) machineOps.connect = addMachineIds.map((id) => ({ id }));
    if (removeMachineIds?.length) machineOps.disconnect = removeMachineIds.map((id) => ({ id }));

    return prisma.appointment.update({
      where: { id },
      data: {
        ...data,
        ...(Object.keys(machineOps).length ? { machines: machineOps } : {}),
      },
      include: { laboratory: true, machines: true },
    });
  }

  async delete(id: number) {
    return prisma.appointment.delete({ where: { id } });
  }
}
