import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('whatsapp_member_onboarding')
@Index(['instanceId', 'canonicalWaId'], { unique: true })
export class WhatsAppMemberOnboarding {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) instanceId: string;
  @Column({ length: 120 }) canonicalWaId: string;
  @Column({ length: 32, nullable: true }) phoneNumber: string | null;
  @Column({ type: 'timestamptz', nullable: true }) contactSavedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) welcomeSentAt: Date | null;
  @Column({ length: 160, nullable: true }) welcomeMessageId: string | null;
  @Column({ length: 120, nullable: true }) originGroupId: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
