import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { TalentInvitesService } from './talent-invites.service';

@Controller('talent-invites')
@UseGuards(FirebaseAuthGuard)
export class TalentInvitesController {
  constructor(private readonly talentInvites: TalentInvitesService) {}

  @Get('me')
  mine(@Req() req: any) {
    return this.talentInvites.mine(req.user);
  }

  @Post('claim')
  claim(@Req() req: any, @Body('token') token: unknown) {
    return this.talentInvites.claim(String(token || ''), req.user);
  }

  @Post(':id/accept')
  accept(@Req() req: any, @Param('id') id: string) {
    return this.talentInvites.accept(id, req.user.uid);
  }

  @Post(':id/view')
  view(@Req() req: any, @Param('id') id: string) {
    return this.talentInvites.markViewed(id, req.user.uid);
  }

  @Post(':id/decline')
  decline(@Req() req: any, @Param('id') id: string) {
    return this.talentInvites.decline(id, req.user.uid);
  }
}
