import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('company_invitations')
export class CompanyInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyId: string;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column({ default: false })
  isCompanyAdmin: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
