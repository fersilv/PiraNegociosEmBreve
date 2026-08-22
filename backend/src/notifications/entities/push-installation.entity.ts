import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('push_installations')
@Index('IDX_push_installations_user_active', ['userId', 'active'])
export class PushInstallation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Index('UQ_push_installations_installation_id', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  installationId: string;

  @Column({ type: 'text', nullable: true })
  token: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  platform: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
