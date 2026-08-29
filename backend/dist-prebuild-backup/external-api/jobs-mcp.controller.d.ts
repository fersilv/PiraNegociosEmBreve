import { DataSource } from 'typeorm';
import { JobMatchService } from '../job-match/job-match.service';
import { ControlledAiAutomationService } from './controlled-ai-automation.service';
import { ExternalJobsService } from './external-jobs.service';
import { JobsOperationsService } from './jobs-operations.service';
export declare class JobsMcpController {
    private readonly jobs;
    private readonly operations;
    private readonly jobMatch;
    private readonly automation;
    private readonly dataSource;
    constructor(jobs: ExternalJobsService, operations: JobsOperationsService, jobMatch: JobMatchService, automation: ControlledAiAutomationService, dataSource: DataSource);
    handle(req: any, res: any): Promise<void>;
    private createExternal;
    private updateExternal;
    private verifyExternal;
    private matchProfileSchema;
    private matchProfileStatus;
    private result;
    private safeStringify;
}
