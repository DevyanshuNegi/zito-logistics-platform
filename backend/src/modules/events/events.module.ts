import { Module } from '@nestjs/common';
import { RequestContextInterceptor } from '../../common/interceptors/request-context.interceptor';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [PrismaModule],
  controllers: [EventsController],
  providers: [EventsService, RequestContextService, RequestContextInterceptor],
  exports: [EventsService, RequestContextService, RequestContextInterceptor],
})
export class EventsModule {}
