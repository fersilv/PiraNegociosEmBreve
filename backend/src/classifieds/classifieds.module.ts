import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module';
import { ChatModule } from '../chat/chat.module';
import { Company } from '../companies/entities/company.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { User } from '../users/entities/user.entity';
import { ClassifiedsAiReviewService } from './classifieds-ai-review.service';
import { ClassifiedsAuctionService } from './classifieds-auction.service';
import { ClassifiedsChatService } from './classifieds-chat.service';
import { ClassifiedsCommerceService } from './classifieds-commerce.service';
import { ClassifiedsEntitlementsService } from './classifieds-entitlements.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';
import { ClassifiedsPrivateController } from './classifieds-private.controller';
import { ClassifiedsPublicController } from './classifieds-public.controller';
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
  controllers: [ClassifiedsPublicController, ClassifiedsPrivateController, ClassifiedsSalesController],
  providers: [
    ClassifiedsService,
    ClassifiedsIdentityService,
    ClassifiedsChatService,
    ClassifiedsAiReviewService,
    ClassifiedsCommerceService,
    ClassifiedsEntitlementsService,
    ClassifiedsAuctionService,
    ClassifiedsSalesService,
    ClassifiedsMarketplacePaymentsService,
  ],
  exports: [
    ClassifiedsService,
    ClassifiedsIdentityService,
    ClassifiedsCommerceService,
    ClassifiedsEntitlementsService,
    ClassifiedsAuctionService,
    ClassifiedsSalesService,
    ClassifiedsMarketplacePaymentsService,
  ],
})
export class ClassifiedsModule {}
