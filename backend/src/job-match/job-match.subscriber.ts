import { Injectable } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { JobMatchService } from './job-match.service';

const MATCH_RELEVANT_COLUMNS = new Set([
  'title',
  'description',
  'requirements',
  'skills',
  'type',
  'workModel',
  'active',
]);

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

  private changedColumns(event: UpdateEvent<Job>) {
    const fromMetadata = event.updatedColumns
      .flatMap((column) => [column.propertyName, column.databaseName])
      .filter(Boolean);
    const fromEntity = event.entity && typeof event.entity === 'object'
      ? Object.keys(event.entity)
      : [];
    return new Set([...fromMetadata, ...fromEntity]);
  }

  async afterInsert(event: InsertEvent<Job>) {
    await this.safelyAnalyze(event.entity, event.entity?.active === true);
  }

  async afterUpdate(event: UpdateEvent<Job>) {
    const changed = this.changedColumns(event);
    if (![...changed].some((column) => MATCH_RELEVANT_COLUMNS.has(column))) return;

    const partial = event.entity as Partial<Job> | undefined;
    const becameActive = partial?.active === true && event.databaseEntity?.active !== true;
    const id = partial?.id || event.databaseEntity?.id;
    if (!id) return;

    // UpdateEvent pode trazer somente os campos alterados. Recarregamos a vaga
    // antes de calcular o fingerprint para nunca analisar um objeto parcial.
    const job = await event.manager.getRepository(Job).findOne({ where: { id } });
    await this.safelyAnalyze(job || undefined, becameActive);
  }
}
