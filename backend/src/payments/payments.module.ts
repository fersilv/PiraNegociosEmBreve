import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { User } from '../users/entities/user.entity';
import {
  PaymentsController,
  AdminPaymentsController,
  EfiPaymentsWebhookController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { BillingSupportService } from './billing-support.service';
import { ProductDurationService } from './product-duration.service';
import { EfiPixService } from './efi-pix.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [PaymentsController, EfiPaymentsWebhookController, AdminPaymentsController],
  providers: [PaymentsService, BillingSupportService, ProductDurationService, EfiPixService, AdminGuard],
  exports: [PaymentsService, BillingSupportService, ProductDurationService, EfiPixService],
})
export class PaymentsModule {}
