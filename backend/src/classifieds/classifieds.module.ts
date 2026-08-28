import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { AdminModule } from '../admin/admin.module';
import { ChatModule } from '../chat/chat.module';
import { Company } from '../companies/entities/company.entity';
import { ComplianceModule } from '../compliance/compliance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { User } from '../users/entities/user.entity';
import { ClassifiedsAiReviewService } from './classifieds-ai-review.service';
import { ClassifiedsArchivedAwareAuctionService } from './classifieds-archived-aware-auction.service';
import { ClassifiedsArchivedAwareCommerceService } from './classifieds-archived-aware-commerce.service';
import { ClassifiedsAuctionEngagementService } from './classifieds-auction-engagement.service';
import { ClassifiedsAuctionExtrasController } from './classifieds-auction-extras.controller';
import { ClassifiedsAuctionGateway } from './classifieds-auction.gateway';
import { ClassifiedsAuctionManagementController } from './classifieds-auction-management.controller';
import { ClassifiedsAuctionManagementService } from './classifieds-auction-management.service';
import { ClassifiedsAuctionPaymentPolicyService } from './classifieds-auction-payment-policy.service';
import { ClassifiedsAuctionPublicController } from './classifieds-auction-public.controller';
import { ClassifiedsAuctionPublicService } from './classifieds-auction-public.service';
import { ClassifiedsAuctionService } from './classifieds-auction.service';
import { ClassifiedsAuctionSettlementService } from './classifieds-auction-settlement.service';
import { ClassifiedsCatalogAdminController } from './classifieds-catalog-admin.controller';
import { ClassifiedsCatalogAdminService } from './classifieds-catalog-admin.service';
import { ClassifiedsCategoryTaxonomyService } from './classifieds-category-taxonomy.service';
import { ClassifiedsChatService } from './classifieds-chat.service';
import { ClassifiedsCheckoutController } from './classifieds-checkout.controller';
import { ClassifiedsCheckoutService } from './classifieds-checkout.service';
import { ClassifiedsCheckoutWebhookController } from './classifieds-checkout-webhook.controller';
import { ClassifiedsCommerceAdminController } from './classifieds-commerce-admin.controller';
import { ClassifiedsCommerceService } from './classifieds-commerce.service';
import { ClassifiedsEntitlementsService } from './classifieds-entitlements.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsLocationService } from './classifieds-location.service';
import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';
import { ClassifiedsOfferChatService } from './classifieds-offer-chat.service';
import { ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';
import { ClassifiedsPrivateController } from './classifieds-private.controller';
import { ClassifiedsPublicController } from './classifieds-public.controller';
import { ClassifiedsReceiptPreferencesService } from './classifieds-receipt-preferences.service';
import { ClassifiedsReviewModerationService } from './classifieds-review-moderation.service';
import { ClassifiedsReviewsAdminController, ClassifiedsReviewsController, ClassifiedsReviewsPublicController } from './classifieds-reviews.controller';
import { ClassifiedsReviewsService } from './classifieds-reviews.service';
import { ClassifiedsSalesController } from './classifieds-sales.controller';
import { ClassifiedsSalesService } from './classifieds-sales.service';
import { ClassifiedsService } from './classifieds.service';
import { ClassifiedCategory } from './entities/classified-category.entity';
import { ClassifiedConversationMessage } from './entities/classified-conversation-message.entity';
import { ClassifiedConversation } from './entities/classified-conversation.entity';
import { ClassifiedFavorite } from './entities/classified-favorite.entity';
import { ClassifiedListingImage } from './entities/classified-listing-image.entity';
import { ClassifiedListing } from './entities/classified-listing.entity';
import { ClassifiedUserPreference } from './entities/classified-user-preference.entity';
import { CompanyClassifiedProfile } from './entities/company-classified-profile.entity';

@Module({
  imports: [
    AdminModule,
    ChatModule,
    ComplianceModule,
    NotificationsModule,
    PaymentsModule,
    TypeOrmModule.forFeature([
      ClassifiedCategory,
      ClassifiedListing,
      ClassifiedListingImage,
      ClassifiedFavorite,
      ClassifiedUserPreference,
      CompanyClassifiedProfile,
      ClassifiedConversation,
      ClassifiedConversationMessage,
      User,
      Company,
    ]),
  ],
  controllers: [
    ClassifiedsPublicController,
    ClassifiedsAuctionPublicController,
    ClassifiedsAuctionManagementController,
    ClassifiedsPrivateController,
    ClassifiedsSalesController,
    ClassifiedsCheckoutController,
    ClassifiedsCheckoutWebhookController,
    ClassifiedsAuctionExtrasController,
    ClassifiedsCommerceAdminController,
    ClassifiedsCatalogAdminController,
    ClassifiedsReviewsController,
    ClassifiedsReviewsPublicController,
    ClassifiedsReviewsAdminController,
  ],
  providers: [
    AdminGuard,
    ClassifiedsService,
    ClassifiedsCategoryTaxonomyService,
    ClassifiedsCatalogAdminService,
    ClassifiedsIdentityService,
    ClassifiedsLocationService,
    ClassifiedsChatService,
    ClassifiedsAiReviewService,
    { provide: ClassifiedsCommerceService, useClass: ClassifiedsArchivedAwareCommerceService },
    ClassifiedsEntitlementsService,
    ClassifiedsAuctionGateway,
    { provide: ClassifiedsAuctionService, useClass: ClassifiedsArchivedAwareAuctionService },
    ClassifiedsAuctionPublicService,
    ClassifiedsAuctionManagementService,
    ClassifiedsAuctionEngagementService,
    ClassifiedsAuctionSettlementService,
    ClassifiedsAuctionPaymentPolicyService,
    ClassifiedsReceiptPreferencesService,
    ClassifiedsSalesService,
    ClassifiedsMarketplacePaymentsService,
    ClassifiedsOfferChatService,
    ClassifiedsMarketplaceTermsService,
    ClassifiedsCheckoutService,
    ClassifiedsReviewModerationService,
    ClassifiedsReviewsService,
  ],
  exports: [
    ClassifiedsService,
    ClassifiedsCategoryTaxonomyService,
    ClassifiedsIdentityService,
    ClassifiedsLocationService,
    ClassifiedsCommerceService,
    ClassifiedsEntitlementsService,
    ClassifiedsAuctionService,
    ClassifiedsAuctionPublicService,
    ClassifiedsAuctionManagementService,
    ClassifiedsAuctionEngagementService,
    ClassifiedsAuctionSettlementService,
    ClassifiedsAuctionPaymentPolicyService,
    ClassifiedsReceiptPreferencesService,
    ClassifiedsSalesService,
    ClassifiedsMarketplacePaymentsService,
    ClassifiedsMarketplaceTermsService,
    ClassifiedsCheckoutService,
    ClassifiedsReviewsService,
  ],
})
export class ClassifiedsModule {}
