import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { CompanyInvitation } from './entities/company-invitation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, CompanyInvitation])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
