import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { PhotoAiService } from './photo-ai.service';

@Controller('ai')
@UseGuards(FirebaseAuthGuard)
export class PhotoAiController {
  constructor(private readonly photoAiService: PhotoAiService) {}

  @Post('professionalize-photo')
  professionalizePhoto(@Body() body: { image?: string }) {
    return this.photoAiService.professionalize(String(body?.image || ''));
  }
}
