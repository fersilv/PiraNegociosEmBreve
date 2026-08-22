import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { User } from '../users/entities/user.entity';
import { PaymentsController, AdminPaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BillingSupportService } from './billing-support.service';
import { ProductDurationService } from './product-duration.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, BillingSupportService, ProductDurationService, AdminGuard],
  exports: [PaymentsService, BillingSupportService, ProductDurationService],
})
export class PaymentsModule {}
