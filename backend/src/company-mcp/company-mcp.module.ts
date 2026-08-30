import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsModule } from '../applications/applications.module';
import { Application } from '../applications/entities/application.entity';
import { ClassifiedsModule } from '../classifieds/classifieds.module';
import { ClassifiedCategory } from '../classifieds/entities/classified-category.entity';
import { ClassifiedListingImage } from '../classifieds/entities/classified-listing-image.entity';
import { ClassifiedListing } from '../classifieds/entities/classified-listing.entity';
import { Company } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { JobsModule } from '../jobs/jobs.module';
import { CompanyMcpController } from './company-mcp.controller';
import { CompanyMcpOAuthController } from './company-mcp-oauth.controller';
import { CompanyMcpOAuthGuard } from './company-mcp-oauth.guard';
import { CompanyMcpOAuthService } from './company-mcp-oauth.service';
import { CompanyMcpOperationsService } from './company-mcp-operations.service';

@Module({
  imports: [
    ClassifiedsModule,
    JobsModule,
    ApplicationsModule,
    TypeOrmModule.forFeature([
      Company,
      ClassifiedCategory,
      ClassifiedListing,
      ClassifiedListingImage,
      Job,
      Application,
    ]),
  ],
  controllers: [CompanyMcpOAuthController, CompanyMcpController],
  providers: [CompanyMcpOAuthService, CompanyMcpOAuthGuard, CompanyMcpOperationsService],
  exports: [CompanyMcpOAuthService],
})
export class CompanyMcpModule {}
