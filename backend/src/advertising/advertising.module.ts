import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { AdvertisingController } from './advertising.controller';
import { Advertisement } from './entities/advertisement.entity';
import { AdvertisingConfig } from './entities/advertising-config.entity';

@Module({ imports: [TypeOrmModule.forFeature([Advertisement, AdvertisingConfig])], controllers: [AdvertisingController], providers: [AdminGuard] })
export class AdvertisingModule {}
