import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('external_api_requests')
export class ExternalApiRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() clientId: string;
  @Column({ length: 40 }) action: string;
  @Column({ type: 'varchar', nullable: true }) jobId: string | null;
  @Column({ length: 24 }) result: string;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<
    string,
    unknown
  > | null;
  @CreateDateColumn() createdAt: Date;
}
