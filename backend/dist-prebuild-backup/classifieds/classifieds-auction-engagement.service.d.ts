import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
export declare class ClassifiedsAuctionEngagementService implements OnModuleInit, OnModuleDestroy {
    private readonly dataSource;
    private readonly notifications;
    private timer;
    constructor(dataSource: DataSource, notifications: NotificationsService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    reminderStatus(uid: string, auctionId: string): Promise<{
        enabled: boolean;
        lastPresenceAt: any;
    }>;
    setReminder(uid: string, auctionId: string, enabledRaw: unknown): Promise<{
        enabled: boolean;
    }>;
    presence(uid: string, auctionId: string): Promise<{
        recorded: boolean;
        at?: undefined;
    } | {
        recorded: boolean;
        at: string;
    }>;
    process(): Promise<{
        activated: any;
        pre: number;
        started: number;
        missed: number;
        closed: number;
    }>;
    private activateScheduled;
    private sendPreStart;
    private sendStart;
    private sendMissYou;
    private sendClosureThanks;
    private claimReminder;
    private assertAuction;
}
