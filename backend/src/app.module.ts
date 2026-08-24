import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JobsModule } from './jobs/jobs.module';
import { UsersModule } from './users/users.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ApplicationsModule } from './applications/applications.module';
import { CompaniesModule } from './companies/companies.module';
import { ChatModule } from './chat/chat.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SeoModule } from './seo/seo.module';
import { AdvertisingModule } from './advertising/advertising.module';
import { ExternalApiModule } from './external-api/external-api.module';
import { PaymentsModule } from './payments/payments.module';
import { JobMatchModule } from './job-match/job-match.module';
import { AiModule } from './ai/ai.module';
import { PublicResumeModule } from './public-resume/public-resume.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'piranegocios',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    JobsModule,
    UsersModule,
    UploadsModule,
    NotificationsModule,
    ApplicationsModule,
    CompaniesModule,
    ChatModule,
    AnalyticsModule,
    SeoModule,
    AdvertisingModule,
    PaymentsModule,
    AiModule,
    PublicResumeModule,
    JobMatchModule,
    ExternalApiModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
