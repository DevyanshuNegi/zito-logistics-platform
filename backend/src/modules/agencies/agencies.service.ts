import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AgenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { name: string; address?: string; latitude?: number; longitude?: number; managerId?: string }) {
    return this.prisma.agency.create({
      data: {
        ...dto,
        status: 'ACTIVE',
      },
    });
  }

  async findAll() {
    return this.prisma.agency.findMany({
      include: { _count: { select: { users: true, bookings: true, staff: true } } },
    });
  }

  async findOne(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id },
      include: { staff: { where: { isActive: true } } },
    });
    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.agency.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.agency.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }
}