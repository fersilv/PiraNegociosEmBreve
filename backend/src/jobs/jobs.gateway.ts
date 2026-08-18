import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class JobsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Mapa para rastrear os IDs dos clientes conectados em cada vaga
  private activeViewers: Map<string, Set<string>> = new Map();

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
  ) {}

  handleConnection(client: Socket) {}

  handleDisconnect(client: Socket) {
    // Ao desconectar, remove o cliente de todas as vagas que ele estava acompanhando
    this.activeViewers.forEach((clients, jobId) => {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        this.emitStatsUpdate(jobId);
      }
    });
  }

  @SubscribeMessage('join-job')
  async handleJoinJob(
    client: Socket,
    payload: { jobId: string; incrementView: boolean },
  ) {
    const { jobId, incrementView } = payload;
    
    if (!jobId) return;

    client.join(jobId);

    // Registra o cliente ativo
    if (!this.activeViewers.has(jobId)) {
      this.activeViewers.set(jobId, new Set());
    }
    this.activeViewers.get(jobId).add(client.id);

    let currentViews = 0;
    try {
      if (incrementView) {
        await this.jobRepository.increment({ id: jobId }, 'views', 1);
      }
      
      const job = await this.jobRepository.findOne({
        where: { id: jobId },
        select: ['views'],
      });
      
      if (job) {
        currentViews = job.views;
      }
    } catch (e) {
      console.error('Error updating views', e);
    }

    this.emitStatsUpdate(jobId, currentViews);
  }

  @SubscribeMessage('leave-job')
  handleLeaveJob(client: Socket, payload: { jobId: string }) {
    const { jobId } = payload;
    
    if (!jobId) return;

    client.leave(jobId);

    if (this.activeViewers.has(jobId)) {
      this.activeViewers.get(jobId).delete(client.id);
      this.emitStatsUpdate(jobId);
    }
  }

  private async emitStatsUpdate(jobId: string, knownViews?: number) {
    const activeCount = this.activeViewers.get(jobId)?.size || 0;

    let views = knownViews;
    
    if (views === undefined) {
      try {
        const job = await this.jobRepository.findOne({
          where: { id: jobId },
          select: ['views'],
        });
        views = job?.views || 0;
      } catch (e) {
        views = 0;
      }
    }

    this.server.to(jobId).emit('job-stats-updated', {
      views,
      activeViewers: activeCount,
    });
  }
}
