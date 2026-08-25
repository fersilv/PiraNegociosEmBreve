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
import {
  WhatsAppOAuthClient,
  WhatsAppOAuthCode,
  WhatsAppOAuthToken,
} from './entities/whatsapp-oauth.entity';
import { WhatsAppAdminController } from './whatsapp-admin.controller';
import { WhatsAppApiController } from './whatsapp-api.controller';
import { WhatsAppApiKeyGuard } from './whatsapp-key.guard';
import { WhatsAppMcpController } from './whatsapp-mcp.controller';
import { WhatsAppOAuthController } from './whatsapp-oauth.controller';
import { WhatsAppOAuthGuard } from './whatsapp-oauth.guard';
import { WhatsAppOAuthService } from './whatsapp-oauth.service';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      WhatsAppInstance,
      WhatsAppApiKey,
      WhatsAppMessage,
      WhatsAppSavedContact,
      WhatsAppOAuthClient,
      WhatsAppOAuthCode,
      WhatsAppOAuthToken,
    ]),
    AuthModule,
  ],
  controllers: [
    WhatsAppAdminController,
    WhatsAppApiController,
    WhatsAppMcpController,
    WhatsAppOAuthController,
  ],
  providers: [
    WhatsAppService,
    WhatsAppOAuthService,
    WhatsAppOAuthGuard,
    WhatsAppApiKeyGuard,
    FirebaseAuthGuard,
    AdminGuard,
  ],
  exports: [WhatsAppService, WhatsAppOAuthService],
})
export class WhatsAppModule {}
