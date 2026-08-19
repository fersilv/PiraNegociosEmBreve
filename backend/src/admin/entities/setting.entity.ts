import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  isPublic: boolean; // Se a configuração pode ser lida publicamente pelo frontend (ex: 'MAINTENANCE_MODE')

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
