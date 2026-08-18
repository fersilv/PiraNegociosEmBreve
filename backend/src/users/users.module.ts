import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { CompanyInvitation } from './entities/company-invitation.entity';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, CompanyInvitation]), AnalyticsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
