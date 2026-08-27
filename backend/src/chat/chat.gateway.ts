import { Logger } from '@nestjs/common';
import { ConnectedSocket, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { FirebaseService } from '../auth/firebase.service';

const defaultFrontendOrigins = process.env.NODE_ENV === 'production'
  ? ['https://piranegocios.com.br', 'https://www.piranegocios.com.br']
  : ['http://localhost:3000'];

@WebSocketGateway({
  path: '/api/socket.io',
  cors: { origin: (process.env.FRONTEND_ORIGIN || defaultFrontendOrigins.join(',')).split(','), credentials: true },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly firebaseService: FirebaseService) {}

  async handleConnection(client: Socket) {
    const token = typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : '';
    if (!token) return client.disconnect(true);
    try {
      const decoded = await this.firebaseService.getAuth().verifyIdToken(token);
      client.data.uid = decoded.uid;
      await client.join(`user:${decoded.uid}`);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('chat:ping')
  ping(@ConnectedSocket() client: Socket) {
    return { ok: Boolean(client.data.uid) };
  }

  publishMessage(message: unknown, recipientIds: string[]) {
    for (const recipientId of recipientIds) {
      this.server.to(`user:${recipientId}`).emit('chat:message', message);
    }
  }

  publishMobileUploadReady(recipientId: string, payload: unknown) {
    this.server.to(`user:${recipientId}`).emit('mobile-upload:ready', payload);
  }

  publishPaymentUpdate(recipientId: string, payload: unknown) {
    if (!recipientId) return;
    this.server.to(`user:${recipientId}`).emit('payment:updated', payload);
  }
}