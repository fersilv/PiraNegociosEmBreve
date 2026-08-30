import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Client } from 'pg';
import { Server, Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import { FirebaseService } from '../auth/firebase.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

const defaultFrontendOrigins = process.env.NODE_ENV === 'production'
  ? ['https://piranegocios.com.br', 'https://www.piranegocios.com.br']
  : ['http://localhost:3000'];

export type ClassifiedOfferRealtimePayload = {
  offerId: string;
  listingId: string;
  status: string;
  operation: 'INSERT' | 'UPDATE';
  buyerUserId?: string | null;
  buyerCompanyId?: string | null;
  sellerUserId?: string | null;
  sellerCompanyId?: string | null;
  at: string;
};

@WebSocketGateway({
  namespace: '/classified-offers',
  path: '/api/socket.io',
  cors: {
    origin: (process.env.FRONTEND_ORIGIN || defaultFrontendOrigins.join(',')).split(','),
    credentials: true,
  },
})
export class ClassifiedsOffersGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ClassifiedsOffersGateway.name);
  private pgListener: Client | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly identities: ClassifiedsIdentityService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    void this.connectPgListener();
  }

  async onModuleDestroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const listener = this.pgListener;
    this.pgListener = null;
    if (listener) await listener.end().catch(() => undefined);
  }

  async handleConnection(client: Socket) {
    const token = typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token.trim() : '';
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const decoded = await this.firebaseService.getAuth().verifyIdToken(token);
      const identity = await this.identities.active(decoded.uid);
      client.data.uid = decoded.uid;
      await client.join(this.userRoom(decoded.uid));
      if (identity.type === 'COMPANY' && identity.company?.id) {
        client.data.companyId = identity.company.id;
        await client.join(this.companyRoom(identity.company.id));
      }
      client.emit('offers:ready', {
        uid: decoded.uid,
        companyId: client.data.companyId || null,
        at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.debug(`Conexão de ofertas recusada: ${String(error)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {
    return undefined;
  }

  @SubscribeMessage('offers:ping')
  ping(@ConnectedSocket() client: Socket) {
    return { ok: Boolean(client.data.uid), at: new Date().toISOString() };
  }

  private publish(payload: ClassifiedOfferRealtimePayload) {
    if (!this.server || !payload.offerId || !payload.listingId) return;
    const rooms = new Set<string>();
    if (payload.buyerUserId) rooms.add(this.userRoom(payload.buyerUserId));
    if (payload.sellerUserId) rooms.add(this.userRoom(payload.sellerUserId));
    if (payload.buyerCompanyId) rooms.add(this.companyRoom(payload.buyerCompanyId));
    if (payload.sellerCompanyId) rooms.add(this.companyRoom(payload.sellerCompanyId));
    for (const room of rooms) this.server.to(room).emit('offers:update', payload);
  }

  private async connectPgListener() {
    if (this.destroyed || this.pgListener) return;
    try {
      const options: any = this.dataSource.options as any;
      const config = options.url
        ? { connectionString: options.url, ssl: options.ssl }
        : {
            host: options.host,
            port: options.port,
            database: options.database,
            user: options.username,
            password: options.password,
            ssl: options.ssl,
          };
      const client = new Client(config as any);
      this.pgListener = client;
      client.on('notification', (message) => {
        if (message.channel !== 'pira_classified_offers' || !message.payload) return;
        try {
          const raw = JSON.parse(message.payload) as Record<string, any>;
          this.publish({
            offerId: String(raw.offerId || ''),
            listingId: String(raw.listingId || ''),
            status: String(raw.status || ''),
            operation: raw.operation === 'INSERT' ? 'INSERT' : 'UPDATE',
            buyerUserId: raw.buyerUserId || null,
            buyerCompanyId: raw.buyerCompanyId || null,
            sellerUserId: raw.sellerUserId || null,
            sellerCompanyId: raw.sellerCompanyId || null,
            at: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.debug(`Evento realtime de oferta inválido: ${String(error)}`);
        }
      });
      client.on('error', (error) => {
        this.logger.warn(`Canal realtime de ofertas perdeu a conexão: ${String(error)}`);
        void this.dropPgListener(client);
      });
      client.on('end', () => void this.dropPgListener(client));
      await client.connect();
      await client.query('LISTEN pira_classified_offers');
      this.logger.log('Canal realtime de ofertas conectado ao PostgreSQL.');
    } catch (error) {
      this.logger.warn(`Realtime de ofertas sem LISTEN/NOTIFY; a UI continuará atualizando após mutações: ${String(error)}`);
      const listener = this.pgListener;
      this.pgListener = null;
      if (listener) await listener.end().catch(() => undefined);
      this.scheduleReconnect();
    }
  }

  private async dropPgListener(client: Client) {
    if (this.pgListener !== client) return;
    this.pgListener = null;
    await client.end().catch(() => undefined);
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectPgListener();
    }, 5000);
    this.reconnectTimer.unref?.();
  }

  private userRoom(uid: string) {
    return `classified-offers:user:${uid}`;
  }

  private companyRoom(companyId: string) {
    return `classified-offers:company:${companyId}`;
  }
}
