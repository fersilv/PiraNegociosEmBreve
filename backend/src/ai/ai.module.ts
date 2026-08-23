import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { JobSkillsService } from './job-skills.service';
import { ResumeImportService } from './resume-import.service';
import { ResumeReviewService } from './resume-review.service';
import { ResumeImprovementService } from './resume-improvement.service';
import { AlignedResumeImprovementService } from './aligned-resume-improvement.service';
import { PhotoAiController } from './photo-ai.controller';
import { PhotoAiService } from './photo-ai.service';
import { AdminModule } from '../admin/admin.module';
import { PaymentsModule } from '../payments/payments.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [AdminModule, PaymentsModule, TypeOrmModule.forFeature([User])],
  controllers: [AiController, PhotoAiController],
  providers: [
    AiService,
    JobSkillsService,
    ResumeImportService,
    ResumeReviewService,
    AlignedResumeImprovementService,
    {
      provide: ResumeImprovementService,
      useExisting: AlignedResumeImprovementService,
    },
    PhotoAiService,
  ],
  exports: [
    AiService,
    JobSkillsService,
    ResumeImportService,
    ResumeReviewService,
    ResumeImprovementService,
    PhotoAiService,
  ],
})
export class AiModule {}
