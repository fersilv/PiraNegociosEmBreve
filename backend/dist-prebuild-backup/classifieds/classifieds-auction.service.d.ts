import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsAuctionGateway } from './classifieds-auction.gateway';
export declare class ClassifiedsAuctionService implements OnModuleInit, OnModuleDestroy {
    private readonly dataSource;
    private readonly identities;
    private readonly notifications;
    private readonly auctionGateway;
    private timer;
    constructor(dataSource: DataSource, identities: ClassifiedsIdentityService, notifications: NotificationsService, auctionGateway: ClassifiedsAuctionGateway);
    onModuleInit(): void;
    onModuleDestroy(): void;
    list(uid: string): Promise<any>;
    detail(uid: string, auctionId: string): Promise<any>;
    create(uid: string, body: Record<string, unknown>): Promise<any>;
    bid(uid: string, auctionId: string, rawAmount: unknown): Promise<any>;
    cancel(uid: string, auctionId: string): Promise<any>;
    assertOffersAllowed(listingId: string): Promise<void>;
    closeDue(): Promise<{
        closed: number;
    }>;
    private closeOneIfDue;
    private finalizeLocked;
    private notifyClosed;
    private decorate;
    private notifyIdentity;
    private parseEndsAt;
    private money;
    private currency;
    private maskName;
}
