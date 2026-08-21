import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { JobSkillsService } from './job-skills.service';
import { ResumeImportService } from './resume-import.service';
import { ResumeReviewService } from './resume-review.service';
import { AdminModule } from '../admin/admin.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [AdminModule, TypeOrmModule.forFeature([User])],
  controllers: [AiController],
  providers: [
    AiService,
    JobSkillsService,
    ResumeImportService,
    ResumeReviewService,
  ],
  exports: [
    AiService,
    JobSkillsService,
    ResumeImportService,
    ResumeReviewService,
  ],
})
export class AiModule {}