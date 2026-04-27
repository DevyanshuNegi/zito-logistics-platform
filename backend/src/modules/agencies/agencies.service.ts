import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

@Injectable()
export class AgenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAgencyDto: CreateAgencyDto) {
    return this.prisma.agency.create({
      data: createAgencyDto,
    });
  }

  async findAll() {
    return this.prisma.agency.findMany();
  }

  async findOne(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id },
    });
    if (!agency) throw new NotFoundException(`Agency with ID ${id} not found`);
    return agency;
  }

  async update(id: string, updateAgencyDto: UpdateAgencyDto) {
    await this.findOne(id); // Check existence
    return this.prisma.agency.update({
      where: { id },
      data: updateAgencyDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check existence
    return this.prisma.agency.update({
      where: { id },
      data: { status: 'INACTIVE' }, // Soft delete / deactivation
    });
  }
}
