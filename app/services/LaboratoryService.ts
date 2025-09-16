import { prisma } from '@/lib/prisma';

export class LaboratoryService {
  async getAll() {
    return prisma.laboratory.findMany({
      orderBy: { created_at: 'asc' },
    });
  }

  async getById(id: number) {
    return prisma.laboratory.findUnique({
      where: { id },
      // include related data when fetching a single lab (handy for detail views)
      include: { machines: true, appointments: true },
    });
  }

  async create(name: string, location: string) {
    return prisma.laboratory.create({
      data: { name, location },
    });
  }

  async update(id: number, name: string, location: string) {
    return prisma.laboratory.update({
      where: { id },
      data: { name, location },
    });
  }

  async delete(id: number) {
    // Will throw if FK constraints prevent delete (e.g., machines/appointments exist)
    return prisma.laboratory.delete({ where: { id } });
  }
}
