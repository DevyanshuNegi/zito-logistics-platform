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
      include: { user: true, agency: true },
    });
  }
}
