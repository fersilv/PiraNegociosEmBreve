import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('classified_conversations')
@Index(['listingId', 'buyerUserId'], { unique: true })
export class ClassifiedConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  listingId: string;

  @Index()
  @Column({ type: 'varchar' })
  buyerUserId: string;

  @Index()
  @Column({ type: 'varchar' })
  sellerUserId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  sellerCompanyId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  buyerLastReadAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  sellerLastReadAt: Date | null;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
