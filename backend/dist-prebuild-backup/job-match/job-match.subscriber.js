"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobMatchSubscriber = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const job_entity_1 = require("../jobs/entities/job.entity");
const notifications_service_1 = require("../notifications/notifications.service");
const job_match_service_1 = require("./job-match.service");
let JobMatchSubscriber = class JobMatchSubscriber {
    jobMatch;
    notifications;
    constructor(dataSource, jobMatch, notifications) {
        this.jobMatch = jobMatch;
        this.notifications = notifications;
        dataSource.subscribers.push(this);
    }
    listenTo() {
        return job_entity_1.Job;
    }
    async safelyNotifyNewJob(job) {
        if (!job?.active || job.isInternal)
            return;
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
        }
        catch (error) {
            console.error(`Não foi possível agendar os alertas da vaga ${job.id}:`, error);
        }
    }
    changedColumns(event) {
        const fromMetadata = event.updatedColumns
            .flatMap((column) => [column.propertyName, column.databaseName])
            .filter(Boolean);
        if (fromMetadata.length > 0)
            return new Set(fromMetadata);
        const fromEntity = event.entity && typeof event.entity === 'object'
            ? Object.keys(event.entity)
            : [];
        return new Set(fromEntity);
    }
    async afterInsert(event) {
        if (event.entity?.active === true)
            await this.safelyNotifyNewJob(event.entity);
    }
    async afterUpdate(event) {
        const changed = this.changedColumns(event);
        if (!changed.has('active'))
            return;
        const partial = event.entity;
        const becameActive = partial?.active === true && event.databaseEntity?.active !== true;
        if (!becameActive)
            return;
        const id = partial?.id || event.databaseEntity?.id;
        if (!id)
            return;
        const job = await event.manager.getRepository(job_entity_1.Job).findOne({ where: { id } });
        await this.safelyNotifyNewJob(job || undefined);
    }
};
exports.JobMatchSubscriber = JobMatchSubscriber;
exports.JobMatchSubscriber = JobMatchSubscriber = __decorate([
    (0, common_1.Injectable)(),
    (0, typeorm_1.EventSubscriber)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        job_match_service_1.JobMatchService,
        notifications_service_1.NotificationsService])
], JobMatchSubscriber);
//# sourceMappingURL=job-match.subscriber.js.map