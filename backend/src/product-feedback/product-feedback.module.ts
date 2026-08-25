import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AdminProductFeedbackController,
  ProductFeedbackController,
  PublicFaqController,
} from './product-feedback.controller';
import { ProductFeedbackService } from './product-feedback.service';
import { SupportAssistantService } from './support-assistant.service';
import { SupportContextService } from './support-context.service';

@Module({
  imports: [AiModule, NotificationsModule, TypeOrmModule.forFeature([User])],
  controllers: [ProductFeedbackController, AdminProductFeedbackController, PublicFaqController],
  providers: [ProductFeedbackService, SupportContextService, SupportAssistantService],
})
export class ProductFeedbackModule {}
