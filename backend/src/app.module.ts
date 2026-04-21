import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    // Pillar modules (Freight, Warehouse, etc.) will be imported here
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}