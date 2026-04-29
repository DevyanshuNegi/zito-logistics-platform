import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CalculateRouteDto,
  DetectDeviationDto,
  RecalculateRouteDto,
} from './dto/route-optimization.dto';
import { RouteOptimizationService } from './route-optimization.service';

@ApiTags('RouteOptimization')
@ApiBearerAuth('JWT')
@Controller('route-optimization')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF)
export class RouteOptimizationController {
  constructor(
    private readonly routeOptimizationService: RouteOptimizationService,
  ) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate a route plan and ETA (PRD §44.17)' })
  calculate(@Body() dto: CalculateRouteDto) {
    return this.routeOptimizationService.calculate(dto);
  }

  @Post('optimize-stops')
  @ApiOperation({ summary: 'Optimize the stop sequence for a multi-stop route (PRD §44.17)' })
  optimizeStops(@Body() dto: CalculateRouteDto) {
    return this.routeOptimizationService.optimizeStops(dto);
  }

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Get the current route plan for a booking (PRD §44.17)' })
  getBookingRoute(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.routeOptimizationService.calculateForBooking(bookingId);
  }

  @Post('booking/:bookingId/recalculate')
  @ApiOperation({ summary: 'Recalculate the route after traffic or road-block changes (PRD §44.17)' })
  recalculate(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: RecalculateRouteDto,
    @Req() req: any,
  ) {
    return this.routeOptimizationService.recalculate(bookingId, dto, req.user.id);
  }

  @Post('booking/:bookingId/detect-deviation')
  @ApiOperation({ summary: 'Detect whether the driver has deviated from the planned route (PRD §44.17)' })
  detectDeviation(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: DetectDeviationDto,
  ) {
    return this.routeOptimizationService.detectDeviation(bookingId, dto);
  }
}
