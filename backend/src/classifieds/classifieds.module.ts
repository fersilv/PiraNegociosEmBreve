import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { ClassifiedsPrivateController, ClassifiedsFavoriteController } from './classifieds-private.controller';
import { ClassifiedsPublicController } from './classifieds-public.controller';
import { ClassifiedsService } from './classifieds.service';
import { ClassifiedCategory } from './entities/classified-category.entity';
import { ClassifiedFavorite } from './entities/classified-favorite.entity';
import { ClassifiedListingImage } from './entities/classified-listing-image.entity';
import { ClassifiedListing } from './entities/classified-listing.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassifiedCategory,
      ClassifiedListing,
      ClassifiedListingImage,
      ClassifiedFavorite,
      User,
      Company,
    ]),
  ],
  controllers: [
    ClassifiedsPublicController,
    ClassifiedsPrivateController,
    ClassifiedsFavoriteController,
  ],
  providers: [ClassifiedsService],
  exports: [ClassifiedsService],
})
export class ClassifiedsModule {}
