import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('advertising_configs')
export class AdvertisingConfig {
  @PrimaryColumn({ default: 'default' })
  id: string;

  @Column({ default: false })
  googleAdsEnabled: boolean;

  @Column({ type: 'varchar', nullable: true })
  googleAdsClient: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleAdsSlotLeaderboard: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleAdsSlotRectangle: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
