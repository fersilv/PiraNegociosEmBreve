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
import { AiService } from '../ai/ai.service';
import { ProductFeedbackService } from './product-feedback.service';

@Controller('product-feedback')
@UseGuards(FirebaseAuthGuard)
export class ProductFeedbackController {
  constructor(
    private readonly feedback: ProductFeedbackService,
    private readonly ai: AiService,
  ) {}

  @Get('status')
  async status() {
    const ai = await this.ai.getStatus();
    return { aiEnabled: ai.enabled };
  }

  @Post()
  submit(@Req() req: any, @Body() body: any) {
    return this.feedback.submit(req.user.uid, body);
  }

  @Get('expectations')
  expectations(@Req() req: any) {
    return this.feedback.mineAwaitingExpectation(req.user.uid);
  }

  @Post(':id/expectation')
  expectation(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.feedback.respondExpectation(req.user.uid, id, body);
  }

  @Get('support/mine')
  mySupport(@Req() req: any) {
    return this.feedback.mySupport(req.user.uid);
  }

  @Post('support/chat')
  supportChat(@Req() req: any, @Body() body: any) {
    return this.feedback.supportChat(req.user.uid, body);
  }

  @Post('support/:id/escalate')
  escalate(@Req() req: any, @Param('id') id: string) {
    return this.feedback.escalateSupport(req.user.uid, id);
  }
}

@Controller('admin/product-feedback')
@UseGuards(FirebaseAuthGuard)
export class AdminProductFeedbackController {
  constructor(private readonly feedback: ProductFeedbackService) {}

  private async admin(req: any) {
    return this.feedback.assertAdmin(req.user.uid);
  }

  @Get('overview')
  async overview(@Req() req: any) {
    await this.admin(req);
    return this.feedback.overview();
  }

  @Post('analyze')
  async analyze(@Req() req: any, @Body() body: any) {
    await this.admin(req);
    return this.feedback.analyze(body?.force === true);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await this.admin(req);
    return this.feedback.updateFeedback(id, body);
  }

  @Get(':source/:id/screenshot')
  async screenshot(
    @Req() req: any,
    @Param('source') source: 'feedback' | 'support',
    @Param('id') id: string,
  ) {
    await this.admin(req);
    return this.feedback.screenshotForAdmin(source, id);
  }

  @Post('support/:id/reply')
  async reply(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await this.admin(req);
    return this.feedback.adminReply(id, body);
  }
}
