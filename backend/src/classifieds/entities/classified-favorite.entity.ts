import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('classified_favorites')
@Index(['listingId', 'userId'], { unique: true })
export class ClassifiedFavorite {
  @PrimaryColumn({ type: 'varchar' })
  userId: string;

  @PrimaryColumn({ type: 'uuid' })
  listingId: string;

  @CreateDateColumn()
  createdAt: Date;
}
