import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminGuard } from '../admin/admin.guard';
import { User } from '../users/entities/user.entity';
import {
  AdminPublicResumeController,
  PublicResumeAccountController,
  PublicResumeController,
} from './public-resume.controller';
import { PublicResumeService } from './public-resume.service';

@Module({
  imports: [
    AuthModule,
    AiModule,
    PaymentsModule,
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [
    PublicResumeController,
    PublicResumeAccountController,
    AdminPublicResumeController,
  ],
  providers: [PublicResumeService, AdminGuard],
  exports: [PublicResumeService],
})
export class PublicResumeModule {}
