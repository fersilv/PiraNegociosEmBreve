import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type ClassifiedIdentityType = 'PERSONAL' | 'COMPANY';

@Entity('classified_user_preferences')
export class ClassifiedUserPreference {
  @PrimaryColumn({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  lastIdentityType: ClassifiedIdentityType | null;

  @Column({ type: 'uuid', nullable: true })
  lastCompanyId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  personalTermsVersion: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  personalTermsAcceptedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
