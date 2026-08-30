import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsOrderOperationsService } from './classifieds-order-operations.service';

@Controller('classifieds')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsOrderOperationsController {
  constructor(
    private readonly operations: ClassifiedsOrderOperationsService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('me/orders/operations/summary')
  summary(@Req() req: any) { return this.operations.summary(req.user.uid); }

  @Get('me/orders/operations')
  list(@Req() req: any) { return this.operations.list(req.user.uid); }

  @Get('me/orders/operations/:orderId')
  detail(@Req() req: any, @Param('orderId') orderId: string) { return this.operations.detail(req.user.uid, orderId); }

  @Post('me/orders/operations/:orderId/conversation')
  async startBuyerConversation(@Req() req: any, @Param('orderId') orderId: string) {
    const order: any = await this.operations.detail(req.user.uid, orderId);
    const listingRows = await this.dataSource.query(
      `SELECT "sellerUserId","companyId" FROM classified_listings WHERE id=$1 LIMIT 1`,
      [order.listingId],
    );
    const listing = listingRows[0];
    const sellerCompanyId = String(order.companyId || listing?.companyId || '').trim();
    const buyerUserId = String(order.buyerUserId || '').trim();
    if (!listing || !sellerCompanyId || !buyerUserId) throw new Error('Não foi possível identificar comprador e vendedor deste pedido.');

    const existing = await this.dataSource.query(
      `SELECT id FROM classified_conversations
       WHERE "listingId"=$1 AND "buyerUserId"=$2 AND "sellerCompanyId"=$3
       ORDER BY "createdAt" DESC LIMIT 1`,
      [order.listingId, buyerUserId, sellerCompanyId],
    ).catch(() => []);
    if (existing[0]?.id) {
      await this.dataSource.query(`UPDATE classified_conversations SET "sellerDeletedAt"=NULL,"updatedAt"=now() WHERE id=$1`, [existing[0].id]).catch(() => undefined);
      return { id: existing[0].id, reused: true };
    }

    const rows = await this.dataSource.query(
      `INSERT INTO classified_conversations(
         "listingId","buyerUserId","buyerCompanyId","sellerUserId","sellerCompanyId",
         "buyerLastReadAt","sellerLastReadAt","lastMessageAt","buyerDeletedAt","sellerDeletedAt","createdAt","updatedAt"
       ) VALUES ($1,$2,NULL,$3,$4,NULL,now(),NULL,NULL,NULL,now(),now()) RETURNING id`,
      [order.listingId, buyerUserId, listing.sellerUserId, sellerCompanyId],
    );
    await this.dataSource.query(
      `INSERT INTO classified_order_events("orderId",type,"actorUserId",metadata)
       VALUES ($1,'SELLER_CONTACT_STARTED',$2,$3::jsonb)`,
      [orderId, req.user.uid, JSON.stringify({ conversationId: rows[0].id, surface: 'MINHAS_VENDAS' })],
    ).catch(() => undefined);
    return { id: rows[0].id, reused: false };
  }

  @Patch('me/orders/operations/:orderId/status')
  status(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) { return this.operations.updateStatus(req.user.uid, orderId, body?.status); }

  @Patch('me/orders/operations/:orderId/priority')
  priority(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) { return this.operations.setPriority(req.user.uid, orderId, body?.priority); }
}
