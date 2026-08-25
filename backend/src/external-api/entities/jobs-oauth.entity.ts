import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from '@nestjs/typeorm/node_modules/typeorm';

@Entity('jobs_oauth_clients')
export class JobsOAuthClient {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 120, unique: true }) clientId: string;
  @Column({ type: 'varchar', length: 180, nullable: true }) clientName: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) redirectUris: string[];
  @Column({ type: 'varchar', length: 40, default: 'none' }) tokenEndpointAuthMethod: string;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('jobs_oauth_codes')
@Index(['apiClientId', 'clientId'])
export class JobsOAuthCode {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, unique: true }) codeHash: string;
  @Column({ type: 'varchar', length: 120 }) clientId: string;
  @Column({ type: 'uuid' }) apiClientId: string;
  @Column({ type: 'text' }) redirectUri: string;
  @Column({ type: 'text' }) resource: string;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) scopes: string[];
  @Column({ type: 'varchar', length: 128 }) codeChallenge: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) usedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity('jobs_oauth_tokens')
@Index(['apiClientId', 'clientId'])
export class JobsOAuthToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) apiClientId: string;
  @Column({ type: 'varchar', length: 120 }) clientId: string;
  @Column({ type: 'varchar', length: 64, unique: true }) accessTokenHash: string;
  @Column({ type: 'varchar', length: 64, unique: true }) refreshTokenHash: string;
  @Column({ type: 'text' }) resource: string;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) scopes: string[];
  @Column({ type: 'timestamptz' }) accessExpiresAt: Date;
  @Column({ type: 'timestamptz' }) refreshExpiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
