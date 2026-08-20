import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { JobSkillsService } from './job-skills.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule], // For SettingsService
  controllers: [AiController],
  providers: [AiService, JobSkillsService],
  exports: [AiService, JobSkillsService],
})
export class AiModule {}
