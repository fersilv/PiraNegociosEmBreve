import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum WhatsAppMessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

@Entity('whatsapp_messages')
@Index(['instanceId', 'createdAt'])
export class WhatsAppMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) instanceId: string;
  @Column({ length: 100, nullable: true }) providerMessageId: string | null;
  @Column({ length: 120 }) chatId: string;
  @Column({ length: 120, nullable: true }) senderId: string | null;
  @Column({
    type: 'enum',
    enum: WhatsAppMessageDirection,
    enumName: 'whatsapp_message_direction_enum',
  })
  direction: WhatsAppMessageDirection;
  @Column({ length: 40, default: 'text' }) type: string;
  @Column({ type: 'text', nullable: true }) body: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null;
  @Column({ type: 'timestamptz', nullable: true }) providerTimestamp: Date | null;
  @CreateDateColumn() createdAt: Date;
}
