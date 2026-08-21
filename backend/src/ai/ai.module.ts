import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { JobSkillsService } from './job-skills.service';
import { ResumeReviewService } from './resume-review.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule],
  controllers: [AiController],
  providers: [AiService, JobSkillsService, ResumeReviewService],
  exports: [AiService, JobSkillsService, ResumeReviewService],
})
export class AiModule {}