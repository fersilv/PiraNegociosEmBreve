import { BadRequestException, Body, Controller, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MobileUploadSession } from './entities/mobile-upload-session.entity';
import { MobileUploadSessionsService } from './mobile-upload-sessions.service';
import { MobileUploadTokenGuard } from './mobile-upload-token.guard';

@Controller('uploads/mobile-transfer')
export class MobileTransferController {
  constructor(private readonly sessions: MobileUploadSessionsService) {}

  @Post(':id/pair')
  pair(@Param('id') id: string, @Body('code') code: unknown) {
    return this.sessions.pair(id, code);
  }

  @Post(':id/file')
  @UseGuards(MobileUploadTokenGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  }))
  upload(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo foi enviado.');
    return this.sessions.receiveAuthorized(req.mobileUploadSession as MobileUploadSession, file);
  }
}
