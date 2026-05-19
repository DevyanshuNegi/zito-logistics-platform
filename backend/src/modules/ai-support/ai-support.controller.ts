import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AiSupportService } from './ai-support.service';
import { ChatAiSupportDto } from './dto/chat-ai-support.dto';
import { EscalateAiSupportDto } from './dto/escalate-ai-support.dto';
import { AiSupportFeedbackDto } from './dto/ai-support-feedback.dto';

@Controller('ai-support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class AiSupportController {
  constructor(private readonly aiSupportService: AiSupportService) {}

  @Post('chat')
  chat(@Req() req: any, @Body() dto: ChatAiSupportDto) {
    return this.aiSupportService.chat(req.user, dto);
  }

  @Post('escalate')
  escalate(@Req() req: any, @Body() dto: EscalateAiSupportDto) {
    return this.aiSupportService.escalate(req.user, dto);
  }

  @Post('feedback')
  feedback(@Req() req: any, @Body() dto: AiSupportFeedbackDto) {
    return this.aiSupportService.feedback(req.user, dto);
  }
}
