import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationsService } from '../applications/applications.service';
import { Application } from '../applications/entities/application.entity';
import { ClassifiedsCategoryTaxonomyService } from '../classifieds/classifieds-category-taxonomy.service';
import { ClassifiedCategory } from '../classifieds/entities/classified-category.entity';
import { ClassifiedListingImage } from '../classifieds/entities/classified-listing-image.entity';
import { ClassifiedListing } from '../classifieds/entities/classified-listing.entity';
import { Company } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { JobsService } from '../jobs/jobs.service';
import { CompanyMcpOperationsService } from './company-mcp-operations.service';
import { CompanyMcpProductLifecycleService } from './company-mcp-product-lifecycle.service';

@Injectable()
export class CompanyMcpSafeOperationsService extends CompanyMcpOperationsService {
  constructor(
    @InjectRepository(Company) companies: Repository<Company>,
    @InjectRepository(ClassifiedCategory) categoriesRepo: Repository<ClassifiedCategory>,
    @InjectRepository(ClassifiedListing) listings: Repository<ClassifiedListing>,
    @InjectRepository(ClassifiedListingImage) images: Repository<ClassifiedListingImage>,
    @InjectRepository(Job) jobs: Repository<Job>,
    @InjectRepository(Application) applications: Repository<Application>,
    taxonomy: ClassifiedsCategoryTaxonomyService,
    jobsService: JobsService,
    applicationsService: ApplicationsService,
    private readonly lifecycle: CompanyMcpProductLifecycleService,
  ) {
    super(
      companies,
      categoriesRepo,
      listings,
      images,
      jobs,
      applications,
      taxonomy,
      jobsService,
      applicationsService,
    );
  }

  override async productStatus(companyId: string, id: string, statusRaw: string) {
    const status = String(statusRaw || '').toUpperCase();
    if (status === 'SOLD') {
      await this.lifecycle.markSold(companyId, id);
      return this.productGet(companyId, id);
    }
    if (status === 'ARCHIVED') {
      await this.lifecycle.archive(companyId, id);
      return this.productGet(companyId, id);
    }
    return super.productStatus(companyId, id, statusRaw);
  }

  override async productArchive(companyId: string, id: string) {
    await this.lifecycle.archive(companyId, id);
    return this.productGet(companyId, id);
  }

  override async jobCreate(companyId: string, actorUserId: string, input: Partial<Job>) {
    const requestedActive = input.active;
    const created = await super.jobCreate(companyId, actorUserId, input);
    if (requestedActive === false) {
      return super.jobStatus(companyId, actorUserId, created.id, false);
    }
    return created;
  }
}
