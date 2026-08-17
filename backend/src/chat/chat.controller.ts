import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Controller('applications/:applicationId/messages')
@UseGuards(FirebaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService, private readonly chatGateway: ChatGateway) {}

  @Get()
  list(@Req() req: any, @Param('applicationId') applicationId: string) {
    return this.chatService.list(applicationId, req.user.uid);
  }

  @Post()
  async send(@Req() req: any, @Param('applicationId') applicationId: string, @Body() body: any) {
    const result = await this.chatService.send(applicationId, req.user.uid, body.body, body.attachment, body.documentId);
    this.chatGateway.publishMessage(result.message, result.recipientIds);
    return result.message;
  }

  @Post('document-request')
  async requestDocument(@Req() req: any, @Param('applicationId') applicationId: string, @Body() body: any) {
    const result = await this.chatService.requestDocument(applicationId, req.user.uid, body);
    this.chatGateway.publishMessage(result.message, result.recipientIds);
    return result.message;
  }
}
