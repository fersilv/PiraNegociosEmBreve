import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('visitor_events')
@Index(['createdAt'])
@Index(['visitorId', 'createdAt'])
export class VisitorEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  visitorId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 32 })
  eventType: string;

  @Column({ type: 'varchar', length: 512 })
  path: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referrerOrigin: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmSource: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmMedium: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmCampaign: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  deviceType: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  browser: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  operatingSystem: string | null;

  @Column({ type: 'int', nullable: true })
  durationSeconds: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
