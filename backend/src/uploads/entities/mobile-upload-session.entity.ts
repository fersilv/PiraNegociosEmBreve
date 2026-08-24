import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export type MobileUploadPurpose = 'avatar' | 'resume' | 'document';
export type MobileUploadStatus = 'WAITING' | 'PAIRED' | 'UPLOADED' | 'CONSUMED' | 'EXPIRED' | 'CANCELED';

@Entity('mobile_upload_sessions')
@Index(['userId', 'status'])
export class MobileUploadSession {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  purpose: MobileUploadPurpose;

  @Column({ type: 'varchar', length: 16, default: 'WAITING' })
  status: MobileUploadStatus;

  @Column({ type: 'varchar', length: 64 })
  pairingHash: string;

  @Column({ type: 'varchar', length: 64 })
  pairingSalt: string;

  @Column({ type: 'int', default: 0 })
  pairingAttempts: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  qrTokenHash: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  uploadTokenHash: string | null;

  @Column({ type: 'int' })
  maxSizeBytes: number;

  @Column({ type: 'text' })
  accept: string;

  @Column({ type: 'text', nullable: true })
  filePath: string | null;

  @Column({ type: 'text', nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  pairedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  uploadedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
