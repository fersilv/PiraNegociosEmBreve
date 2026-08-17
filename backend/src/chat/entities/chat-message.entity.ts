import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum ChatMessageType {
  TEXT = 'TEXT',
  DOCUMENT_REQUEST = 'DOCUMENT_REQUEST',
  DOCUMENT = 'DOCUMENT',
}

@Entity('chat_messages')
@Index(['applicationId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  applicationId: string;

  @Column()
  senderId: string;

  @Column()
  senderName: string;

  @Column()
  senderRole: string;

  @Column({ type: 'enum', enum: ChatMessageType, default: ChatMessageType.TEXT })
  type: ChatMessageType;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attachment: { name: string; data: string; mimeType: string; size: number } | null;

  @Column({ nullable: true })
  documentId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  documentRequest: { id: string; name: string; instructions?: string; required: boolean } | null;

  @CreateDateColumn()
  createdAt: Date;
}
