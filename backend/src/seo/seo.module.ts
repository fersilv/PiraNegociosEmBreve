import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { PublicSeoController } from './public-seo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Job])],
  controllers: [PublicSeoController],
})
export class SeoModule {}
