import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('whatsapp_group_automations')
@Index(['instanceId', 'groupId'], { unique: true })
export class WhatsAppGroupAutomation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) instanceId: string;
  @Column({ length: 120 }) groupId: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) groupName: string | null;
  @Column({ default: false }) monitored: boolean;
  @Column({ default: false }) approveMembers: boolean;
  @Column({ default: false }) saveContacts: boolean;
  @Column({ default: false }) sendWelcome: boolean;
  @Column({ default: true }) includeGroupDescription: boolean;
  @Column({ default: false }) rejectMembers: boolean;
  @Column({ default: false }) removeMembers: boolean;
  @Column({ default: false }) manageAdmins: boolean;
  @Column({ default: false }) editGroupInfo: boolean;
  @Column({ default: false }) sendGroupMessages: boolean;
  @Column({ type: 'text', nullable: true }) welcomeTemplate: string | null;
  @Column({ type: 'text', nullable: true }) channelUrl: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
