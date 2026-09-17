import { Module } from '@nestjs/common';
import { ClassifiedsModule } from '../classifieds/classifieds.module';
import { PdvIntegrationController } from './pdv-integration.controller';
import { PdvIntegrationService } from './pdv-integration.service';
@Module({ imports:[ClassifiedsModule], controllers:[PdvIntegrationController], providers:[PdvIntegrationService], exports:[PdvIntegrationService] })
export class PdvIntegrationModule {}
