import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { classifiedsCommerceFeatureFlags } from './classifieds-commerce-feature-flags';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

@Injectable()
export class ClassifiedsServiceQuotesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  private assertEnabled() {
    if (!classifiedsCommerceFeatureFlags().consultativeQuotes) throw new BadRequestException('Orçamentos consultivos ainda não estão habilitados neste ambiente.');
  }

  private async companyId(uid: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY' || !identity.company?.id) throw new ForbiddenException('Orçamentos da empresa exigem o workspace Business.');
    return identity.company.id;
  }
}
