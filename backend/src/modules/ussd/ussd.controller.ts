import { Body, Controller, Header, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UssdRequestDto } from './dto/ussd-request.dto';
import { UssdService } from './ussd.service';

@ApiTags('USSD')
@Controller('ussd')
export class UssdController {
  constructor(private readonly ussdService: UssdService) {}

  @Post()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: "Africa's Talking USSD entry point for book, track, and pay fallback flows (PRD §23)" })
  handle(@Body() dto: UssdRequestDto) {
    return this.ussdService.handle(dto);
  }
}
