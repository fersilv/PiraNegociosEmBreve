import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('institutions')
export class Institution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  coverImage: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  website: string;

  @Column({ default: false })
  isVerified: boolean;

  // Futuras expansões para a comunidade
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Pode armazenar estatísticas de álbuns, posts, etc.

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
