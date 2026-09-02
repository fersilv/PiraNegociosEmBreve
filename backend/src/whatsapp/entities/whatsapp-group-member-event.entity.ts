import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('whatsapp_group_member_events')
@Index(['instanceId', 'groupId', 'memberCanonicalId'])
@Index(['instanceId', 'occurredAt'])
export class WhatsAppGroupMemberEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) instanceId: string;
  @Column({ length: 120 }) groupId: string;
  @Column({ length: 120, nullable: true }) memberWaId: string | null;
  @Column({ length: 120, nullable: true }) memberCanonicalId: string | null;
  @Column({ length: 120, nullable: true }) actorWaId: string | null;
  @Column({ length: 60 }) eventType: string;
  @Column({ type: 'jsonb', nullable: true }) payload: Record<string, unknown> | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) occurredAt: Date;
  @CreateDateColumn() createdAt: Date;
}
