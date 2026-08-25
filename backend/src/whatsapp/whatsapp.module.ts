import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { AdminModule } from '../admin/admin.module';
import { AiModule } from '../ai/ai.module';
import { Application } from '../applications/entities/application.entity';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { Company } from '../companies/entities/company.entity';
import { JobMatchModule } from '../job-match/job-match.module';
import { Job } from '../jobs/entities/job.entity';
import { JobsModule } from '../jobs/jobs.module';
import { PaymentsModule } from '../payments/payments.module';
import { User } from '../users/entities/user.entity';
import { WhatsAppApiKey } from './entities/whatsapp-api-key.entity';
import { WhatsAppConversation, WhatsAppPhoneOtp } from './entities/whatsapp-concierge.entity';
import { WhatsAppSavedContact } from './entities/whatsapp-contact.entity';
import { WhatsAppInstance } from './entities/whatsapp-instance.entity';
import { WhatsAppMessage } from './entities/whatsapp-message.entity';
import {
  WhatsAppOAuthClient,
  WhatsAppOAuthCode,
  WhatsAppOAuthToken,
} from './entities/whatsapp-oauth.entity';
import { WhatsAppAdminController } from './whatsapp-admin.controller';
import { WhatsAppAiService } from './whatsapp-ai.service';
import { WhatsAppAlertService } from './whatsapp-alert.service';
import { WhatsAppApiController } from './whatsapp-api.controller';
import { WhatsAppConciergeService } from './whatsapp-concierge.service';
import { WhatsAppApiKeyGuard } from './whatsapp-key.guard';
import { WhatsAppMcpController } from './whatsapp-mcp.controller';
import { WhatsAppOAuthController } from './whatsapp-oauth.controller';
import { WhatsAppOAuthGuard } from './whatsapp-oauth.guard';
import { WhatsAppOAuthService } from './whatsapp-oauth.service';
import { WhatsAppPhoneVerificationController } from './whatsapp-phone-verification.controller';
import { WhatsAppPhoneVerificationService } from './whatsapp-phone-verification.service';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Company,
      Job,
      Application,
      WhatsAppInstance,
      WhatsAppApiKey,
      WhatsAppMessage,
      WhatsAppSavedContact,
      WhatsAppOAuthClient,
      WhatsAppOAuthCode,
      WhatsAppOAuthToken,
      WhatsAppConversation,
      WhatsAppPhoneOtp,
    ]),
    AuthModule,
    AdminModule,
    AiModule,
    PaymentsModule,
    JobsModule,
    JobMatchModule,
  ],
  controllers: [
    WhatsAppAdminController,
    WhatsAppApiController,
    WhatsAppMcpController,
    WhatsAppOAuthController,
    WhatsAppPhoneVerificationController,
  ],
  providers: [
    WhatsAppService,
    WhatsAppAiService,
    WhatsAppAlertService,
    WhatsAppConciergeService,
    WhatsAppPhoneVerificationService,
    WhatsAppOAuthService,
    WhatsAppOAuthGuard,
    WhatsAppApiKeyGuard,
    FirebaseAuthGuard,
    AdminGuard,
  ],
  exports: [WhatsAppService, WhatsAppOAuthService, WhatsAppPhoneVerificationService],
})
export class WhatsAppModule {}
