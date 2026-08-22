import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Application } from '../applications/entities/application.entity';
import { Company } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { AdminGuard } from './admin.guard';

@Controller('admin/job-details')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminJobDetailsController {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
  ) {}

  @Get(':id')
  async details(@Param('id') id: string) {
    const job = await this.jobs.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Vaga não encontrada.');

    const [company, applicationCount] = await Promise.all([
      job.companyId ? this.companies.findOne({ where: { id: job.companyId } }) : Promise.resolve(null),
      this.applications.count({ where: { jobId: id } }),
    ]);

    return {
      job,
      company: company
        ? {
            id: company.id,
            name: company.name,
            slug: company.slug,
            city: company.city,
            state: company.state,
            verificationStatus: company.verificationStatus,
          }
        : null,
      applicationCount,
    };
  }
}
