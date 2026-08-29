import { Repository } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
export declare class JobsOperationsService {
    private readonly jobs;
    constructor(jobs: Repository<Job>);
    get(id: string): Promise<Job>;
    reviewQueue(input: {
        status?: string;
        active?: boolean;
        city?: string;
        state?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        data: Job[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>;
    stats(): Promise<{
        total: number;
        active: number;
        inactive: number;
        flagged: number;
        moderationPending: number;
        review: Record<string, number>;
    }>;
    setActive(id: string, active: boolean, actor: string, note?: string): Promise<Job>;
    setReview(id: string, statusRaw: string, actor: string, note?: string): Promise<Job>;
    flag(id: string, actor: string, data: {
        reason?: string;
        observation?: string;
    }): Promise<Job>;
    clearFlag(id: string, actor: string, note?: string): Promise<Job>;
    remove(id: string): Promise<{
        success: boolean;
        id: string;
    }>;
    private requireJob;
    private requireReviewStatus;
    private actor;
    private note;
}
