import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string; // References User.id

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  read: boolean;

  @Column({ nullable: true })
  link: string; // Optional link to redirect on click

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  jobId: string;

  @Column({ nullable: true })
  appId: string;

  @CreateDateColumn()
  createdAt: Date;
}
