import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('account_accesses')
@Index(['userId', 'createdAt'])
@Index(['ipHash', 'createdAt'])
export class AccountAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ipHash: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  deviceHash: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  deviceType: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  browser: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  operatingSystem: string | null;

  @Column({ default: false })
  isNewDevice: boolean;

  @Column({ type: 'varchar', length: 32, default: 'PROFILE_ACCESS' })
  eventType: string;

  @CreateDateColumn()
  createdAt: Date;
}
