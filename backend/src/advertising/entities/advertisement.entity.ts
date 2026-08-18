import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('advertisements')
export class Advertisement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'varchar', length: 32 })
  type: string; // leaderboard, rectangle, sidebar or carousel

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text' })
  imageURL: string;

  @Column({ type: 'text' })
  link: string;

  @Column({ type: 'varchar', nullable: true })
  companyId: string | null;

  @Column({ type: 'varchar', nullable: true })
  contractedByUserId: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  billingPeriod: string | null; // DAILY, WEEKLY, MONTHLY, CAMPAIGN

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
