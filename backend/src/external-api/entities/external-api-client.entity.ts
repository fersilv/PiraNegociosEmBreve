import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('external_api_clients')
export class ExternalApiClient {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 120 }) name: string;
  @Column({ length: 160 }) sourceLabel: string;
  @Column({ length: 20, unique: true }) keyPrefix: string;
  @Column({ length: 64 }) keyHash: string;
  @Column({ type: 'jsonb', default: () => '\'["jobs:read","jobs:write"]\'' })
  scopes: string[];
  @Column({ type: 'varchar', length: 8, default: 'v1' })
  apiVersion: 'v1' | 'v2';
  @Column({ type: 'varchar', length: 12, default: 'api' })
  audience: 'api' | 'mcp';
  @Column({ default: true }) active: boolean;
  @Column() createdById: string;
  @Column({ type: 'timestamptz', nullable: true }) lastUsedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
