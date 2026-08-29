import { DataSource, Repository } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { JobMatchService } from './job-match.service';
export declare class JobMatchAdminService {
    private readonly jobs;
    private readonly dataSource;
    private readonly jobMatch;
    constructor(jobs: Repository<Job>, dataSource: DataSource, jobMatch: JobMatchService);
    overview(): Promise<any>;
    updateConfig(input: {
        durationDays?: unknown;
    }): Promise<any>;
    backfillQueue(limit?: number): Promise<any>;
    prepareOne(jobId: string): Promise<{
        jobId: string;
        title: string;
        success: boolean;
        status: any;
        error: any;
    }>;
    backfill(limit?: number): Promise<{
        processed: any;
        attempted: any;
        succeeded: number;
        failed: number;
        errors: {
            jobId: string;
            title: string;
            error: string | null;
        }[];
        overview: any;
    }>;
}
