import { Injectable } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { JobMatchService } from './job-match.service';

@Injectable()
@EventSubscriber()
export class JobMatchSubscriber implements EntitySubscriberInterface<Job> {
  constructor(
    dataSource: DataSource,
    private readonly jobMatch: JobMatchService,
    private readonly notifications: NotificationsService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Job;
  }

  private async safelyAnalyze(job: Job | undefined, notifyAsNew = false) {
    if (!job?.active) return;

    let profile: any = null;
    try {
      profile = await this.jobMatch.analyzeActiveJob(job);
    } catch (error) {
      console.error(`Não foi possível preparar a vaga ${job.id} para o Match Inteligente:`, error);
    }

    if (!notifyAsNew || job.isInternal) return;

    try {
      const earlyRecipients = profile
        ? await this.jobMatch.getEarlyAlertRecipientsForJob(job.id)
        : [];
      await this.notifications.notifyNewJob({
        jobId: job.id,
        jobTitle: job.title,
        companyName: job.companyName,
        location: job.location,
        city: job.city,
        state: job.state,
        slug: job.slug,
      }, earlyRecipients);
    } catch (error) {
      console.error(`Não foi possível agendar os alertas da vaga ${job.id}:`, error);
    }
  }

  async afterInsert(event: InsertEvent<Job>) {
    await this.safelyAnalyze(event.entity, event.entity?.active === true);
  }

  async afterUpdate(event: UpdateEvent<Job>) {
    const job = event.entity as Job | undefined;
    const becameActive = job?.active === true && event.databaseEntity?.active !== true;
    await this.safelyAnalyze(job, becameActive);
  }
}
