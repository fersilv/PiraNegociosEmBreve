import { Injectable } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { JobMatchService } from './job-match.service';

@Injectable()
@EventSubscriber()
export class JobMatchSubscriber implements EntitySubscriberInterface<Job> {
  constructor(
    dataSource: DataSource,
    private readonly jobMatch: JobMatchService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Job;
  }

  private async safelyAnalyze(job: Job | undefined) {
    if (!job?.active) return;
    try {
      await this.jobMatch.analyzeActiveJob(job);
    } catch (error) {
      console.error(`Não foi possível preparar a vaga ${job.id} para o Match Inteligente:`, error);
    }
  }

  async afterInsert(event: InsertEvent<Job>) {
    await this.safelyAnalyze(event.entity);
  }

  async afterUpdate(event: UpdateEvent<Job>) {
    await this.safelyAnalyze(event.entity as Job | undefined);
  }
}
