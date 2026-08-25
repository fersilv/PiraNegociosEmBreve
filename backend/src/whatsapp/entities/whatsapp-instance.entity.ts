import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum WhatsAppConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  QR_REQUIRED = 'QR_REQUIRED',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

@Entity('whatsapp_instances')
export class WhatsAppInstance {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 100 }) name: string;
  @Column({ length: 180, nullable: true }) purpose: string | null;
  @Column({ length: 32, nullable: true }) phoneNumber: string | null;
  @Column({ length: 40, unique: true }) sessionName: string;
  @Column({ length: 30, default: 'wppconnect' }) provider: string;
  @Column({
    type: 'enum',
    enum: WhatsAppConnectionStatus,
    default: WhatsAppConnectionStatus.DISCONNECTED,
  })
  status: WhatsAppConnectionStatus;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) allowedScopes: string[];
  @Column({ default: true }) active: boolean;
  @Column({ type: 'text', nullable: true }) lastError: string | null;
  @Column({ type: 'timestamptz', nullable: true }) lastConnectedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt: Date | null;
  @Column() createdById: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
