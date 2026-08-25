import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('whatsapp_conversations')
@Index(['instanceId', 'chatId'], { unique: true })
export class WhatsAppConversation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) instanceId: string;
  @Column({ type: 'varchar', length: 120 }) chatId: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) whatsappId: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) phoneE164: string | null;
  @Column({ type: 'varchar', nullable: true }) userId: string | null;
  @Column({ type: 'varchar', nullable: true }) companyId: string | null;
  @Column({ type: 'varchar', length: 24, default: 'UNRESOLVED' }) contextMode: string;
  @Column({ type: 'varchar', length: 40, nullable: true }) activeFlow: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) state: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) lastInboundAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastProcessedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('whatsapp_phone_otps')
@Index(['userId', 'phoneE164'])
export class WhatsAppPhoneOtp {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column({ type: 'uuid' }) instanceId: string;
  @Column({ type: 'varchar', length: 20 }) phoneE164: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) whatsappId: string | null;
  @Column({ type: 'varchar', length: 64 }) codeHash: string;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) verifiedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
