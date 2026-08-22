import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type RegistrationInterestSource = 'EMAIL' | 'GOOGLE';
export type RegistrationInterestStatus = 'WAITING' | 'INVITED' | 'CONVERTED';

@Entity('registration_interests')
export class RegistrationInterest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'varchar', length: 16, default: 'EMAIL' })
  source: RegistrationInterestSource;

  @Column({ type: 'varchar', length: 16, default: 'WAITING' })
  status: RegistrationInterestStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
