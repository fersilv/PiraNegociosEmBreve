import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AdminProductFeedbackController,
  ProductFeedbackController,
} from './product-feedback.controller';
import { ProductFeedbackService } from './product-feedback.service';

@Module({
  imports: [AiModule, NotificationsModule, TypeOrmModule.forFeature([User])],
  controllers: [ProductFeedbackController, AdminProductFeedbackController],
  providers: [ProductFeedbackService],
})
export class ProductFeedbackModule {}
