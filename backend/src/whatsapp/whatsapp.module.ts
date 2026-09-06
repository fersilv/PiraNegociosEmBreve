import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { AdminModule } from '../admin/admin.module';
import { AiModule } from '../ai/ai.module';
import { Application } from '../applications/entities/application.entity';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { CompanyPlansModule } from '../company-plans/company-plans.module';
import { Company } from '../companies/entities/company.entity';
import { JobsOAuthClient } from '../external-api/entities/jobs-oauth.entity';
import { ExternalApiModule } from '../external-api/external-api.module';
import { JobMatchModule } from '../job-match/job-match.module';
import { Job } from '../jobs/entities/job.entity';
import { JobsModule } from '../jobs/jobs.module';
import { PaymentsModule } from '../payments/payments.module';
import { User } from '../users/entities/user.entity';
import { OAuthBrokerController } from './oauth-broker.controller';
import { OAuthBrokerService } from './oauth-broker.service';
import { WhatsAppApiKey } from './entities/whatsapp-api-key.entity';
import { WhatsAppConversation, WhatsAppPhoneOtp } from './entities/whatsapp-concierge.entity';
import { WhatsAppSavedContact } from './entities/whatsapp-contact.entity';
import { WhatsAppGroupAutomation } from './entities/whatsapp-group-automation.entity';
import { WhatsAppGroupMemberEvent } from './entities/whatsapp-group-member-event.entity';
import { WhatsAppMemberOnboarding } from './entities/whatsapp-member-onboarding.entity';
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
      WhatsAppGroupAutomation,
      WhatsAppGroupMemberEvent,
      WhatsAppMemberOnboarding,
      WhatsAppOAuthClient,
      WhatsAppOAuthCode,
      WhatsAppOAuthToken,
      JobsOAuthClient,
      WhatsAppConversation,
      WhatsAppPhoneOtp,
    ]),
    AuthModule,
    AdminModule,
    AiModule,
    PaymentsModule,
    JobsModule,
    JobMatchModule,
    ExternalApiModule,
    CompanyPlansModule,
  ],
  controllers: [
    WhatsAppAdminController,
    WhatsAppApiController,
    WhatsAppMcpController,
    OAuthBrokerController,
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
    OAuthBrokerService,
    WhatsAppOAuthGuard,
    WhatsAppApiKeyGuard,
    FirebaseAuthGuard,
    AdminGuard,
  ],
  exports: [
    WhatsAppService,
    WhatsAppOAuthService,
    OAuthBrokerService,
    WhatsAppPhoneVerificationService,
  ],
})
export class WhatsAppModule {}
