import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
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
export class ClassifiedsOrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ClassifiedsOrdersGateway.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly identities: ClassifiedsIdentityService,
  ) {}

  async handleConnection(client: Socket) {
    const token = typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token.trim() : '';
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const decoded = await this.firebaseService.getAuth().verifyIdToken(token);
      const identity = await this.identities.active(decoded.uid);
      if (identity.type !== 'COMPANY' || !identity.company?.id) {
        client.disconnect(true);
        return;
      }
      client.data.uid = decoded.uid;
      client.data.companyId = identity.company.id;
      await client.join(this.companyRoom(identity.company.id));
      client.emit('orders:ready', { companyId: identity.company.id, at: new Date().toISOString() });
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
    return { ok: Boolean(client.data.companyId), at: new Date().toISOString() };
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

  private companyRoom(companyId: string) {
    return `classified-orders:company:${companyId}`;
  }
}
