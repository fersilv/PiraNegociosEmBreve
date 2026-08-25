import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { WhatsAppApiKey } from './entities/whatsapp-api-key.entity';
import { WhatsAppSavedContact } from './entities/whatsapp-contact.entity';
import { WhatsAppInstance } from './entities/whatsapp-instance.entity';
import { WhatsAppMessage } from './entities/whatsapp-message.entity';
import { WhatsAppAdminController } from './whatsapp-admin.controller';
import { WhatsAppApiController } from './whatsapp-api.controller';
import { WhatsAppApiKeyGuard } from './whatsapp-key.guard';
import { WhatsAppMcpController } from './whatsapp-mcp.controller';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      WhatsAppInstance,
      WhatsAppApiKey,
      WhatsAppMessage,
      WhatsAppSavedContact,
    ]),
    AuthModule,
  ],
  controllers: [WhatsAppAdminController, WhatsAppApiController, WhatsAppMcpController],
  providers: [WhatsAppService, WhatsAppApiKeyGuard, FirebaseAuthGuard, AdminGuard],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
