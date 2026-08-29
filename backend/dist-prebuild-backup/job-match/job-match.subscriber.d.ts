import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { JobMatchService } from './job-match.service';
export declare class JobMatchSubscriber implements EntitySubscriberInterface<Job> {
    private readonly jobMatch;
    private readonly notifications;
    constructor(dataSource: DataSource, jobMatch: JobMatchService, notifications: NotificationsService);
    listenTo(): typeof Job;
    private safelyNotifyNewJob;
    private changedColumns;
    afterInsert(event: InsertEvent<Job>): Promise<void>;
    afterUpdate(event: UpdateEvent<Job>): Promise<void>;
}
