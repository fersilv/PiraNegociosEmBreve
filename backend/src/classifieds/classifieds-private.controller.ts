import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsService } from './classifieds.service';

@Controller('classifieds/me')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsPrivateController {
  constructor(private readonly classifieds: ClassifiedsService) {}

  @Get('listings')
  mine(@Req() req: any) {
    return this.classifieds.mine(req.user.uid);
  }

  @Get('favorites')
  favorites(@Req() req: any) {
    return this.classifieds.favorites(req.user.uid);
  }

  @Post('listings')
  create(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.classifieds.create(req.user.uid, body || {});
  }

  @Patch('listings/:id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.classifieds.update(req.user.uid, id, body || {});
  }

  @Post('listings/:id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.classifieds.publish(req.user.uid, id);
  }

  @Post('listings/:id/status')
  status(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status?: unknown },
  ) {
    return this.classifieds.setStatus(req.user.uid, id, body?.status);
  }
}

@Controller('classifieds')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsFavoriteController {
  constructor(private readonly classifieds: ClassifiedsService) {}

  @Post('listings/:id/favorite')
  favorite(@Req() req: any, @Param('id') id: string) {
    return this.classifieds.toggleFavorite(req.user.uid, id);
  }
}
