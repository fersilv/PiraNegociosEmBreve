import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { FirebaseService } from '../auth/firebase.service';

const defaultFrontendOrigins = process.env.NODE_ENV === 'production'
  ? ['https://piranegocios.com.br', 'https://www.piranegocios.com.br']
  : ['http://localhost:3000'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@WebSocketGateway({
  namespace: '/auctions',
  path: '/api/socket.io',
  cors: {
    origin: (process.env.FRONTEND_ORIGIN || defaultFrontendOrigins.join(',')).split(','),
    credentials: true,
  },
})
export class ClassifiedsAuctionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ClassifiedsAuctionGateway.name);

  constructor(private readonly firebaseService: FirebaseService) {}

  async handleConnection(client: Socket) {
    const token = typeof client.handshake.auth?.token === 'string'
      ? client.handshake.auth.token.trim()
      : '';

    if (token) {
      try {
        const decoded = await this.firebaseService.getAuth().verifyIdToken(token);
        client.data.uid = decoded.uid;
      } catch {
        // A arena é pública. Token inválido apenas transforma esta conexão em anônima.
        client.data.uid = null;
      }
    }

    await client.join('auction:lobby');
  }

  async handleDisconnect(client: Socket) {
    const room = typeof client.data.auctionRoom === 'string' ? client.data.auctionRoom : '';
    if (!room) return;
    queueMicrotask(() => void this.emitPresence(room));
  }

  @SubscribeMessage('auction:join')
  async joinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { auctionId?: unknown },
  ) {
    const auctionId = this.auctionId(body?.auctionId);
    if (!auctionId) return { ok: false, message: 'Leilão inválido.' };

    const previousRoom = typeof client.data.auctionRoom === 'string' ? client.data.auctionRoom : '';
    const room = `auction:${auctionId}`;

    if (previousRoom && previousRoom !== room) {
      await client.leave(previousRoom);
      await this.emitPresence(previousRoom);
    }

    client.data.auctionRoom = room;
    await client.join(room);
    await this.emitPresence(room);
    return { ok: true, auctionId };
  }

  @SubscribeMessage('auction:leave')
  async leaveAuction(@ConnectedSocket() client: Socket) {
    const room = typeof client.data.auctionRoom === 'string' ? client.data.auctionRoom : '';
    if (!room) return { ok: true };
    client.data.auctionRoom = null;
    await client.leave(room);
    await this.emitPresence(room);
    return { ok: true };
  }

  @SubscribeMessage('auction:refresh')
  refreshAuction(
    @ConnectedSocket() _client: Socket,
    @MessageBody() body: { auctionId?: unknown },
  ) {
    const auctionId = this.auctionId(body?.auctionId);
    if (!auctionId) return { ok: false, message: 'Leilão inválido.' };

    const payload = { auctionId, at: new Date().toISOString() };
    this.server.to(`auction:${auctionId}`).emit('auction:update', payload);
    this.server.to('auction:lobby').emit('auction:update', payload);
    return { ok: true };
  }

  private async emitPresence(room: string) {
    try {
      const sockets = await this.server.in(room).fetchSockets();
      const identities = new Set(
        sockets.map((socket) => socket.data.uid ? `user:${socket.data.uid}` : `socket:${socket.id}`),
      );
      const auctionId = room.startsWith('auction:') ? room.slice('auction:'.length) : null;
      if (!auctionId) return;
      this.server.to(room).emit('auction:presence', {
        auctionId,
        online: identities.size,
        at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.debug(`Não foi possível atualizar presença da sala ${room}: ${String(error)}`);
    }
  }

  private auctionId(value: unknown) {
    const id = String(value || '').trim();
    return UUID_RE.test(id) ? id : null;
  }
}
