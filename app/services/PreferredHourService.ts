import { PreferredHour } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class PreferredHourService {
  async getAll() {
    return prisma.preferredHour.findMany({
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });
  }

  async getById(id: number) {
    return prisma.preferredHour.findUnique({ where: { id } });
  }

  // Keeping your original signature to minimize refactors
  async create(preferredHour: Omit<PreferredHour, 'id' | 'created_at'>) {
    return prisma.preferredHour.create({ data: preferredHour });
  }

  async update(
    id: number,
    preferredHour: Partial<Omit<PreferredHour, 'id' | 'created_at'>>
  ) {
    return prisma.preferredHour.update({
      where: { id },
      data: preferredHour,
    });
  }

  async delete(id: number) {
    return prisma.preferredHour.delete({ where: { id } });
  }
}
