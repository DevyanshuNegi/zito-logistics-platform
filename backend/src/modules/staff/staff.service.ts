import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createStaffDto: any) {
    return this.prisma.staff.create({
      data: createStaffDto,
    });
  }

  async findAll() {
    return this.prisma.staff.findMany({
      include: { agency: true },
    });
  }

  async findOne(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: { agency: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }
}

