import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('whatsapp_saved_contacts')
@Index(['instanceId', 'waId'], { unique: true })
export class WhatsAppSavedContact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) instanceId: string;
  @Column({ length: 120 }) waId: string;
  @Column({ length: 32 }) phoneNumber: string;
  @Column({ length: 160 }) name: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
