import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module';
import { User } from '../users/entities/user.entity';
import { PaymentsController, AdminPaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AdminModule, TypeOrmModule.forFeature([User])],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
