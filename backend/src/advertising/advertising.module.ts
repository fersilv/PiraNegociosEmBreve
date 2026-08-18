import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { User } from '../users/entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { AdvertisingController } from './advertising.controller';
import { Advertisement } from './entities/advertisement.entity';
import { AdvertisingConfig } from './entities/advertising-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Advertisement, AdvertisingConfig, User, Company]),
  ],
  controllers: [AdvertisingController],
  providers: [AdminGuard],
})
export class AdvertisingModule {}
