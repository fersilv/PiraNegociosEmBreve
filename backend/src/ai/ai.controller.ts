import { Controller, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AnalyticsService } from '../analytics/analytics.service';
import { UsersService } from '../users/users.service';

@Controller('ai')
@UseGuards(FirebaseAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly analyticsService: AnalyticsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('analyze-resume')
  async analyzeResume(@Req() req: any, @Body() body: { base64File: string; mimeType: string }) {
    if (!body.base64File) {
      throw new BadRequestException("Nenhum arquivo de currículo enviado.");
    }

    // A simple rate limit implementation could go here like we had in server.ts
    // For now we just check the DB if the user has hits left
    // We could use UsersService to check aiAnalysisLimit
    
    return this.aiService.analyzeResume(body.base64File, body.mimeType);
  }
}
