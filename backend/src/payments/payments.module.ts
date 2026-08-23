import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { User } from '../users/entities/user.entity';
import {
  PaymentsController,
  AdminPaymentsController,
  EfiPaymentsWebhookController,
  MercadoPagoPaymentsWebhookController,
} from './payments.controller';
import { PaymentProviderPublicController } from './payment-provider-public.controller';
import { PaymentsService } from './payments.service';
import { BillingSupportService } from './billing-support.service';
import { ProductDurationService } from './product-duration.service';
import { EfiPixService } from './efi-pix.service';
import { MercadoPagoService } from './mercado-pago.service';
import { PaymentProviderVaultService } from './payment-provider-vault.service';
import { PaymentProviderConfigService } from './payment-provider-config.service';
import { PaymentProviderManagerService } from './payment-provider-manager.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [
    PaymentsController,
    PaymentProviderPublicController,
    EfiPaymentsWebhookController,
    MercadoPagoPaymentsWebhookController,
    AdminPaymentsController,
  ],
  providers: [
    PaymentsService,
    BillingSupportService,
    ProductDurationService,
    PaymentProviderVaultService,
    PaymentProviderConfigService,
    EfiPixService,
    MercadoPagoService,
    PaymentProviderManagerService,
    AdminGuard,
  ],
  exports: [
    PaymentsService,
    BillingSupportService,
    ProductDurationService,
    PaymentProviderConfigService,
    PaymentProviderManagerService,
    EfiPixService,
    MercadoPagoService,
  ],
})
export class PaymentsModule {}
