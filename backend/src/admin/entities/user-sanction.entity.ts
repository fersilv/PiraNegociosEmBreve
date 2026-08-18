import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum UserSanctionStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

@Entity('user_sanctions')
@Index(['userId', 'createdAt'])
export class UserSanction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  createdById: string;

  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: UserSanctionStatus, default: UserSanctionStatus.ACTIVE })
  status: UserSanctionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
