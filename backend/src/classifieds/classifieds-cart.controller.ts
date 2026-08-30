import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsCartService } from './classifieds-cart.service';

@Controller('classifieds/cart')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsCartController {
  constructor(private readonly cart: ClassifiedsCartService) {}

  @Get()
  current(@Req() req: any) {
    return this.cart.current(req.user.uid);
  }

  @Post('items/:listingId')
  add(@Req() req: any, @Param('listingId') listingId: string, @Body() body: Record<string, unknown>) {
    return this.cart.add(req.user.uid, listingId, body.quantity, body.replaceOtherCompany === true);
  }

  @Patch('items/:itemId')
  setQuantity(@Req() req: any, @Param('itemId') itemId: string, @Body() body: Record<string, unknown>) {
    return this.cart.setQuantity(req.user.uid, itemId, body.quantity);
  }

  @Delete('items/:itemId')
  remove(@Req() req: any, @Param('itemId') itemId: string) {
    return this.cart.remove(req.user.uid, itemId);
  }

  @Delete()
  clear(@Req() req: any) {
    return this.cart.clear(req.user.uid);
  }

  @Patch('fulfillment')
  fulfillment(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.cart.selectFulfillment(req.user.uid, body);
  }

  @Get('payment-config')
  paymentConfig(@Req() req: any) {
    return this.cart.paymentConfig(req.user.uid);
  }

  @Post('pay')
  pay(@Req() req: any, @Body() body: Record<string, any>) {
    return this.cart.createPayment(req.user.uid, body);
  }
}
