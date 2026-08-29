"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassifiedsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const admin_module_1 = require("../admin/admin.module");
const chat_module_1 = require("../chat/chat.module");
const company_entity_1 = require("../companies/entities/company.entity");
const compliance_module_1 = require("../compliance/compliance.module");
const notifications_module_1 = require("../notifications/notifications.module");
const payments_module_1 = require("../payments/payments.module");
const user_entity_1 = require("../users/entities/user.entity");
const classifieds_ai_review_service_1 = require("./classifieds-ai-review.service");
const classifieds_archived_aware_auction_service_1 = require("./classifieds-archived-aware-auction.service");
const classifieds_archived_aware_commerce_service_1 = require("./classifieds-archived-aware-commerce.service");
const classifieds_archived_aware_sales_service_1 = require("./classifieds-archived-aware-sales.service");
const classifieds_auction_engagement_service_1 = require("./classifieds-auction-engagement.service");
const classifieds_auction_extras_controller_1 = require("./classifieds-auction-extras.controller");
const classifieds_auction_gateway_1 = require("./classifieds-auction.gateway");
const classifieds_auction_management_controller_1 = require("./classifieds-auction-management.controller");
const classifieds_auction_management_service_1 = require("./classifieds-auction-management.service");
const classifieds_auction_payment_policy_service_1 = require("./classifieds-auction-payment-policy.service");
const classifieds_auction_public_controller_1 = require("./classifieds-auction-public.controller");
const classifieds_auction_public_service_1 = require("./classifieds-auction-public.service");
const classifieds_auction_service_1 = require("./classifieds-auction.service");
const classifieds_auction_settlement_service_1 = require("./classifieds-auction-settlement.service");
const classifieds_catalog_admin_controller_1 = require("./classifieds-catalog-admin.controller");
const classifieds_catalog_admin_service_1 = require("./classifieds-catalog-admin.service");
const classifieds_category_taxonomy_service_1 = require("./classifieds-category-taxonomy.service");
const classifieds_chat_service_1 = require("./classifieds-chat.service");
const classifieds_checkout_controller_1 = require("./classifieds-checkout.controller");
const classifieds_checkout_service_1 = require("./classifieds-checkout.service");
const classifieds_checkout_webhook_controller_1 = require("./classifieds-checkout-webhook.controller");
const classifieds_commerce_admin_controller_1 = require("./classifieds-commerce-admin.controller");
const classifieds_commerce_service_1 = require("./classifieds-commerce.service");
const classifieds_entitlements_service_1 = require("./classifieds-entitlements.service");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
const classifieds_lifecycle_controller_1 = require("./classifieds-lifecycle.controller");
const classifieds_lifecycle_service_1 = require("./classifieds-lifecycle.service");
const classifieds_listing_lifecycle_schema_service_1 = require("./classifieds-listing-lifecycle-schema.service");
const classifieds_location_service_1 = require("./classifieds-location.service");
const classifieds_marketplace_payments_service_1 = require("./classifieds-marketplace-payments.service");
const classifieds_offer_chat_service_1 = require("./classifieds-offer-chat.service");
const classifieds_marketplace_terms_service_1 = require("./classifieds-marketplace-terms.service");
const classifieds_private_controller_1 = require("./classifieds-private.controller");
const classifieds_public_controller_1 = require("./classifieds-public.controller");
const classifieds_receipt_preferences_service_1 = require("./classifieds-receipt-preferences.service");
const classifieds_review_moderation_service_1 = require("./classifieds-review-moderation.service");
const classifieds_reviews_controller_1 = require("./classifieds-reviews.controller");
const classifieds_reviews_service_1 = require("./classifieds-reviews.service");
const classifieds_sales_controller_1 = require("./classifieds-sales.controller");
const classifieds_sales_service_1 = require("./classifieds-sales.service");
const classifieds_service_1 = require("./classifieds.service");
const classified_category_entity_1 = require("./entities/classified-category.entity");
const classified_conversation_message_entity_1 = require("./entities/classified-conversation-message.entity");
const classified_conversation_entity_1 = require("./entities/classified-conversation.entity");
const classified_favorite_entity_1 = require("./entities/classified-favorite.entity");
const classified_listing_image_entity_1 = require("./entities/classified-listing-image.entity");
const classified_listing_entity_1 = require("./entities/classified-listing.entity");
const classified_user_preference_entity_1 = require("./entities/classified-user-preference.entity");
const company_classified_profile_entity_1 = require("./entities/company-classified-profile.entity");
let ClassifiedsModule = class ClassifiedsModule {
};
exports.ClassifiedsModule = ClassifiedsModule;
exports.ClassifiedsModule = ClassifiedsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            admin_module_1.AdminModule,
            chat_module_1.ChatModule,
            compliance_module_1.ComplianceModule,
            notifications_module_1.NotificationsModule,
            payments_module_1.PaymentsModule,
            typeorm_1.TypeOrmModule.forFeature([
                classified_category_entity_1.ClassifiedCategory,
                classified_listing_entity_1.ClassifiedListing,
                classified_listing_image_entity_1.ClassifiedListingImage,
                classified_favorite_entity_1.ClassifiedFavorite,
                classified_user_preference_entity_1.ClassifiedUserPreference,
                company_classified_profile_entity_1.CompanyClassifiedProfile,
                classified_conversation_entity_1.ClassifiedConversation,
                classified_conversation_message_entity_1.ClassifiedConversationMessage,
                user_entity_1.User,
                company_entity_1.Company,
            ]),
        ],
        controllers: [
            classifieds_public_controller_1.ClassifiedsPublicController,
            classifieds_auction_public_controller_1.ClassifiedsAuctionPublicController,
            classifieds_auction_management_controller_1.ClassifiedsAuctionManagementController,
            classifieds_private_controller_1.ClassifiedsPrivateController,
            classifieds_lifecycle_controller_1.ClassifiedsLifecycleController,
            classifieds_sales_controller_1.ClassifiedsSalesController,
            classifieds_checkout_controller_1.ClassifiedsCheckoutController,
            classifieds_checkout_webhook_controller_1.ClassifiedsCheckoutWebhookController,
            classifieds_auction_extras_controller_1.ClassifiedsAuctionExtrasController,
            classifieds_commerce_admin_controller_1.ClassifiedsCommerceAdminController,
            classifieds_catalog_admin_controller_1.ClassifiedsCatalogAdminController,
            classifieds_reviews_controller_1.ClassifiedsReviewsController,
            classifieds_reviews_controller_1.ClassifiedsReviewsPublicController,
            classifieds_reviews_controller_1.ClassifiedsReviewsAdminController,
        ],
        providers: [
            admin_guard_1.AdminGuard,
            classifieds_service_1.ClassifiedsService,
            classifieds_category_taxonomy_service_1.ClassifiedsCategoryTaxonomyService,
            classifieds_catalog_admin_service_1.ClassifiedsCatalogAdminService,
            classifieds_lifecycle_service_1.ClassifiedsLifecycleService,
            classifieds_listing_lifecycle_schema_service_1.ClassifiedsListingLifecycleSchemaService,
            classifieds_identity_service_1.ClassifiedsIdentityService,
            classifieds_location_service_1.ClassifiedsLocationService,
            classifieds_chat_service_1.ClassifiedsChatService,
            classifieds_ai_review_service_1.ClassifiedsAiReviewService,
            { provide: classifieds_commerce_service_1.ClassifiedsCommerceService, useClass: classifieds_archived_aware_commerce_service_1.ClassifiedsArchivedAwareCommerceService },
            classifieds_entitlements_service_1.ClassifiedsEntitlementsService,
            classifieds_auction_gateway_1.ClassifiedsAuctionGateway,
            { provide: classifieds_auction_service_1.ClassifiedsAuctionService, useClass: classifieds_archived_aware_auction_service_1.ClassifiedsArchivedAwareAuctionService },
            classifieds_auction_public_service_1.ClassifiedsAuctionPublicService,
            classifieds_auction_management_service_1.ClassifiedsAuctionManagementService,
            classifieds_auction_engagement_service_1.ClassifiedsAuctionEngagementService,
            classifieds_auction_settlement_service_1.ClassifiedsAuctionSettlementService,
            classifieds_auction_payment_policy_service_1.ClassifiedsAuctionPaymentPolicyService,
            classifieds_receipt_preferences_service_1.ClassifiedsReceiptPreferencesService,
            { provide: classifieds_sales_service_1.ClassifiedsSalesService, useClass: classifieds_archived_aware_sales_service_1.ClassifiedsArchivedAwareSalesService },
            classifieds_marketplace_payments_service_1.ClassifiedsMarketplacePaymentsService,
            classifieds_offer_chat_service_1.ClassifiedsOfferChatService,
            classifieds_marketplace_terms_service_1.ClassifiedsMarketplaceTermsService,
            classifieds_checkout_service_1.ClassifiedsCheckoutService,
            classifieds_review_moderation_service_1.ClassifiedsReviewModerationService,
            classifieds_reviews_service_1.ClassifiedsReviewsService,
        ],
        exports: [
            classifieds_service_1.ClassifiedsService,
            classifieds_category_taxonomy_service_1.ClassifiedsCategoryTaxonomyService,
            classifieds_identity_service_1.ClassifiedsIdentityService,
            classifieds_lifecycle_service_1.ClassifiedsLifecycleService,
            classifieds_location_service_1.ClassifiedsLocationService,
            classifieds_commerce_service_1.ClassifiedsCommerceService,
            classifieds_entitlements_service_1.ClassifiedsEntitlementsService,
            classifieds_auction_service_1.ClassifiedsAuctionService,
            classifieds_auction_public_service_1.ClassifiedsAuctionPublicService,
            classifieds_auction_management_service_1.ClassifiedsAuctionManagementService,
            classifieds_auction_engagement_service_1.ClassifiedsAuctionEngagementService,
            classifieds_auction_settlement_service_1.ClassifiedsAuctionSettlementService,
            classifieds_auction_payment_policy_service_1.ClassifiedsAuctionPaymentPolicyService,
            classifieds_receipt_preferences_service_1.ClassifiedsReceiptPreferencesService,
            classifieds_sales_service_1.ClassifiedsSalesService,
            classifieds_marketplace_payments_service_1.ClassifiedsMarketplacePaymentsService,
            classifieds_marketplace_terms_service_1.ClassifiedsMarketplaceTermsService,
            classifieds_checkout_service_1.ClassifiedsCheckoutService,
            classifieds_reviews_service_1.ClassifiedsReviewsService,
        ],
    })
], ClassifiedsModule);
//# sourceMappingURL=classifieds.module.js.map