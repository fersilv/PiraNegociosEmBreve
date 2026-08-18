import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
@Entity('company_talent_folders')
@Index(['companyId', 'name'], { unique: true })
export class CompanyTalentFolder {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() companyId: string;
  @Column({ length: 100 }) name: string;
  @CreateDateColumn() createdAt: Date;
}
