import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EventsService } from './events.service';

@ApiTags('Events')
@Controller('events')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('architecture')
  @ApiOperation({
    summary: 'Enterprise event architecture status and supported PRD event catalog',
  })
  architecture() {
    return {
      status: 'READY',
      deliveryMode:
        process.env.RABBITMQ_URL || process.env.KAFKA_BROKERS
          ? 'external-adapter-ready'
          : 'in-process',
      brokerConfigured: Boolean(process.env.RABBITMQ_URL || process.env.KAFKA_BROKERS),
      supportedEvents: this.eventsService.getSupportedEvents(),
      guarantees: [
        'correlation-id propagation',
        'idempotency-key de-duplication per process',
        'internal audit fallback',
        'future RabbitMQ/Kafka adapter hook',
      ],
    };
  }
}
