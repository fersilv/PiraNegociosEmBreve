import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { PublicSeoController } from './public-seo.controller';
import { CompanySlugAlias } from '../companies/entities/company-slug-alias.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Job, CompanySlugAlias])],
  controllers: [PublicSeoController],
})
export class SeoModule {}
