import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { User } from '../users/entities/user.entity';
import { PaymentsController, AdminPaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, AdminGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
