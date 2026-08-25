import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from '../chat/chat.module';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { ClassifiedsChatService } from './classifieds-chat.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsPrivateController } from './classifieds-private.controller';
import { ClassifiedsPublicController } from './classifieds-public.controller';
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
    ChatModule,
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
  controllers: [ClassifiedsPublicController, ClassifiedsPrivateController],
  providers: [ClassifiedsService, ClassifiedsIdentityService, ClassifiedsChatService],
  exports: [ClassifiedsService, ClassifiedsIdentityService],
})
export class ClassifiedsModule {}
