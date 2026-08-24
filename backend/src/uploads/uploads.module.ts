import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ChatModule } from '../chat/chat.module';
import { UploadsController } from './uploads.controller';
import { MobileUploadSession } from './entities/mobile-upload-session.entity';
import { MobileUploadSessionsService } from './mobile-upload-sessions.service';
import { MobileUploadTokenGuard } from './mobile-upload-token.guard';
import { MobileUploadSessionsController } from './mobile-upload-sessions.controller';
import { MobileTransferController } from './mobile-transfer.controller';

const allowedUploadExtensions = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]);

@Module({
  imports: [
    ChatModule,
    TypeOrmModule.forFeature([MobileUploadSession]),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        if (!allowedUploadExtensions.has(extension)) {
          callback(new Error('Tipo de arquivo não permitido.'), false);
          return;
        }
        callback(null, true);
      },
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  ],
  providers: [MobileUploadSessionsService, MobileUploadTokenGuard],
  controllers: [UploadsController, MobileUploadSessionsController, MobileTransferController],
})
export class UploadsModule {}
