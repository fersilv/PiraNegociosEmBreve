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

export type ClassifiedOrderRealtimeReason = 'CREATED' | 'PAYMENT' | 'STATUS' | 'PRIORITY' | 'DELIVERY';

@WebSocketGateway({
  namespace: '/classified-orders',
  path: '/api/socket.io',
  cors: {
    origin: (process.env.FRONTEND_ORIGIN || defaultFrontendOrigins.join(',')).split(','),
    credentials: true,
  },
})
export class ClassifiedsOrdersGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ClassifiedsOrdersGateway.name);
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
      client.data.uid = decoded.uid;
      await client.join(this.userRoom(decoded.uid));

      let companyId: string | null = null;
      try {
        const identity = await this.identities.active(decoded.uid);
        if (identity.type === 'COMPANY' && identity.company?.id) {
          companyId = identity.company.id;
          client.data.companyId = companyId;
          await client.join(this.companyRoom(companyId));
        }
      } catch {
        // Usuário comprador não precisa de uma identidade Business ativa para receber o próprio pedido.
      }

      client.emit('orders:ready', { userId: decoded.uid, companyId, at: new Date().toISOString() });
    } catch (error) {
      this.logger.debug(`Conexão de pedidos recusada: ${String(error)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {
    return undefined;
  }

  @SubscribeMessage('orders:ping')
  ping(@ConnectedSocket() client: Socket) {
    return { ok: Boolean(client.data.uid), at: new Date().toISOString() };
  }

  publishCompanyOrderChanged(companyId: string, orderId: string, reason: ClassifiedOrderRealtimeReason, snapshot?: Record<string, unknown> | null) {
    const cleanCompanyId = String(companyId || '').trim();
    const cleanOrderId = String(orderId || '').trim();
    if (!cleanCompanyId || !cleanOrderId || !this.server) return;
    this.server.to(this.companyRoom(cleanCompanyId)).emit('orders:update', {
      companyId: cleanCompanyId,
      orderId: cleanOrderId,
      reason,
      snapshot: snapshot || null,
      at: new Date().toISOString(),
    });
  }

  publishBuyerOrderChanged(userId: string, orderId: string, reason: ClassifiedOrderRealtimeReason, snapshot?: Record<string, unknown> | null) {
    const cleanUserId = String(userId || '').trim();
    const cleanOrderId = String(orderId || '').trim();
    if (!cleanUserId || !cleanOrderId || !this.server) return;
    this.server.to(this.userRoom(cleanUserId)).emit('orders:update', {
      userId: cleanUserId,
      orderId: cleanOrderId,
      reason,
      snapshot: snapshot || null,
      at: new Date().toISOString(),
    });
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
        if (message.channel !== 'pira_classified_orders' || !message.payload) return;
        void this.handleDatabaseNotification(message.payload);
      });
      client.on('error', (error) => {
        this.logger.warn(`Canal realtime de pedidos perdeu a conexão: ${String(error)}`);
        void this.dropPgListener(client);
      });
      client.on('end', () => void this.dropPgListener(client));
      await client.connect();
      await client.query('LISTEN pira_classified_orders');
      this.logger.log('Canal realtime de pedidos conectado ao PostgreSQL.');
    } catch (error) {
      this.logger.warn(`Realtime de pedidos sem LISTEN/NOTIFY; a UI continuará com polling: ${String(error)}`);
      const listener = this.pgListener;
      this.pgListener = null;
      if (listener) await listener.end().catch(() => undefined);
      this.scheduleReconnect();
    }
  }

  private async handleDatabaseNotification(rawPayload: string) {
    try {
      const payload = JSON.parse(rawPayload) as Record<string, any>;
      const orderId = String(payload.orderId || '').trim();
      const companyId = String(payload.companyId || '').trim();
      if (!orderId || !companyId) return;

      const reason: ClassifiedOrderRealtimeReason = payload.operation === 'INSERT'
        ? 'CREATED'
        : String(payload.paymentStatus || '') === 'APPROVED'
          ? 'PAYMENT'
          : 'STATUS';
      const snapshot = {
        status: payload.status || null,
        paymentStatus: payload.paymentStatus || null,
      };

      this.publishCompanyOrderChanged(companyId, orderId, reason, snapshot);

      const buyerRows = await this.dataSource.query(
        `SELECT "buyerUserId" FROM classified_orders WHERE id=$1 LIMIT 1`,
        [orderId],
      ).catch(() => []);
      const buyerUserId = String(buyerRows[0]?.buyerUserId || '').trim();
      if (buyerUserId) this.publishBuyerOrderChanged(buyerUserId, orderId, reason, snapshot);
    } catch (error) {
      this.logger.debug(`Evento de pedido realtime inválido: ${String(error)}`);
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

  private companyRoom(companyId: string) {
    return `classified-orders:company:${companyId}`;
  }

  private userRoom(userId: string) {
    return `classified-orders:user:${userId}`;
  }
}
