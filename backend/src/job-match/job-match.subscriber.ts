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

  async afterInsert(event: InsertEvent<Job>) {
    if (event.entity?.active) await this.jobMatch.analyzeActiveJob(event.entity);
  }

  async afterUpdate(event: UpdateEvent<Job>) {
    const job = event.entity as Job | undefined;
    if (job?.active) await this.jobMatch.analyzeActiveJob(job);
  }
}
