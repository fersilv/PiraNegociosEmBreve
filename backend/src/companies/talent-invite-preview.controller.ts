import { Controller, Get, Param } from '@nestjs/common';
import { TalentInvitesService } from './talent-invites.service';

@Controller('public/talent-invites')
export class TalentInvitePreviewController {
  constructor(private readonly talentInvites: TalentInvitesService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.talentInvites.preview(token);
  }
}
