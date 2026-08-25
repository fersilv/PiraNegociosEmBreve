import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('whatsapp_api_keys')
@Index(['instanceId', 'active'])
export class WhatsAppApiKey {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) instanceId: string;
  @Column({ length: 100 }) name: string;
  @Column({ length: 24, unique: true }) keyPrefix: string;
  @Column({ length: 64 }) keyHash: string;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) scopes: string[];
  @Column({ default: true }) active: boolean;
  @Column() createdById: string;
  @Column({ type: 'timestamptz', nullable: true }) lastUsedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
