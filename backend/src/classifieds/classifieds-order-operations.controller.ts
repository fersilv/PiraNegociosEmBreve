import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsOrderOperationsService } from './classifieds-order-operations.service';

@Controller('classifieds')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsOrderOperationsController {
  constructor(private readonly operations: ClassifiedsOrderOperationsService) {}

  @Get('me/orders/operations/summary')
  summary(@Req() req: any) {
    return this.operations.summary(req.user.uid);
  }

  @Get('me/orders/operations')
  list(@Req() req: any) {
    return this.operations.list(req.user.uid);
  }

  @Get('me/orders/operations/:orderId')
  detail(@Req() req: any, @Param('orderId') orderId: string) {
    return this.operations.detail(req.user.uid, orderId);
  }

  @Patch('me/orders/operations/:orderId/status')
  status(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return this.operations.updateStatus(req.user.uid, orderId, body?.status);
  }

  @Patch('me/orders/operations/:orderId/priority')
  priority(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return this.operations.setPriority(req.user.uid, orderId, body?.priority);
  }
}
