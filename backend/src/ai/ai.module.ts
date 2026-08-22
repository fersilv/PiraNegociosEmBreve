import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { JobSkillsService } from './job-skills.service';
import { ResumeImportService } from './resume-import.service';
import { ResumeReviewService } from './resume-review.service';
import { PhotoAiController } from './photo-ai.controller';
import { PhotoAiService } from './photo-ai.service';
import { AdminModule } from '../admin/admin.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [AdminModule, TypeOrmModule.forFeature([User])],
  controllers: [AiController, PhotoAiController],
  providers: [
    AiService,
    JobSkillsService,
    ResumeImportService,
    ResumeReviewService,
    PhotoAiService,
  ],
  exports: [
    AiService,
    JobSkillsService,
    ResumeImportService,
    ResumeReviewService,
    PhotoAiService,
  ],
})
export class AiModule {}