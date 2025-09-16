import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class MachineService {
  async getAllByLaboratory(laboratoryId: number) {
    return prisma.machine.findMany({
      where: { laboratory_id: laboratoryId },
      orderBy: { created_at: 'asc' },
    });
  }

  async getAll() {
    return prisma.machine.findMany({
      orderBy: { created_at: 'asc' },
    });
  }

  async getById(id: number) {
    return prisma.machine.findUnique({
      where: { id },
      include: { laboratory: true }, // often useful for UI
    });
  }

  async create(name: string, power_consumption: number, laboratory_id: number) {
    // Coerce to Decimal to avoid float rounding issues
    const pc = new Prisma.Decimal(power_consumption);
    return prisma.machine.create({
      data: { name, power_consumption: pc, laboratory_id },
    });
  }

  async update(
    id: number,
    name: string,
    power_consumption: number,
    laboratory_id: number
  ) {
    const pc = new Prisma.Decimal(power_consumption);
    return prisma.machine.update({
      where: { id },
      data: { name, power_consumption: pc, laboratory_id },
    });
  }

  async delete(id: number) {
    return prisma.machine.delete({ where: { id } });
  }
}
