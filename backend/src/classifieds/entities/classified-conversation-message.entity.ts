import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ClassifiedConversationMessageType = 'TEXT' | 'OFFER' | 'SYSTEM';
export type ClassifiedConversationSide = 'BUYER' | 'SELLER';

@Entity('classified_conversation_messages')
@Index(['conversationId', 'createdAt'])
export class ClassifiedConversationMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'varchar' })
  senderId: string;

  @Column({ type: 'varchar', length: 160 })
  senderName: string;

  @Column({ type: 'varchar', length: 10 })
  senderRole: ClassifiedConversationSide;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 20, default: 'TEXT' })
  messageType: ClassifiedConversationMessageType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
