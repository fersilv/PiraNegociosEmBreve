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

  /**
   * IMPORTANTE: este subscriber nunca deve gerar perfil de vaga com IA.
   *
   * O perfil de matching passa a ser preparado somente por request explícito
   * (API/MCP/admin) e persistido em job_match_profiles. Aqui nós apenas
   * reaproveitamos um perfil READY, quando ele já existir, para manter os
   * alertas antecipados sem disparar modelo de IA em background.
   */
  private async safelyNotifyNewJob(job: Job | undefined) {
    if (!job?.active || job.isInternal) return;

    try {
      const earlyRecipients = await this.jobMatch.getEarlyAlertRecipientsForJob(job.id);
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

    if (fromMetadata.length > 0) return new Set(fromMetadata);

    const fromEntity = event.entity && typeof event.entity === 'object'
      ? Object.keys(event.entity)
      : [];
    return new Set(fromEntity);
  }

  async afterInsert(event: InsertEvent<Job>) {
    if (event.entity?.active === true) await this.safelyNotifyNewJob(event.entity);
  }

  async afterUpdate(event: UpdateEvent<Job>) {
    const changed = this.changedColumns(event);
    if (!changed.has('active')) return;

    const partial = event.entity as Partial<Job> | undefined;
    const becameActive = partial?.active === true && event.databaseEntity?.active !== true;
    if (!becameActive) return;

    const id = partial?.id || event.databaseEntity?.id;
    if (!id) return;

    const job = await event.manager.getRepository(Job).findOne({ where: { id } });
    await this.safelyNotifyNewJob(job || undefined);
  }
}
