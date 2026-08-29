import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { FirebaseService } from '../auth/firebase.service';
export declare class ClassifiedsAuctionGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly firebaseService;
    server: Server;
    private readonly logger;
    constructor(firebaseService: FirebaseService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    joinAuction(client: Socket, body: {
        auctionId?: unknown;
    }): Promise<{
        ok: boolean;
        message: string;
        auctionId?: undefined;
    } | {
        ok: boolean;
        auctionId: string;
        message?: undefined;
    }>;
    leaveAuction(client: Socket): Promise<{
        ok: boolean;
    }>;
    publishAuctionChanged(auctionId: string, reason: 'BID' | 'EXTENDED' | 'ENDED' | 'CANCELED' | 'CREATED', snapshot?: Record<string, unknown> | null): void;
    private emitPresence;
    private auctionId;
}
