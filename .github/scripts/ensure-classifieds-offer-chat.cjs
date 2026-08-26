const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
process.chdir(root);

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) { fs.writeFileSync(file, next); console.log(`updated ${file}`); }
}

patch('backend/src/classifieds/classifieds.module.ts', (input) => {
  let source = input;
  if (!source.includes("./classifieds-offer-chat.service")) {
    source = source.replace("import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';", "import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';\nimport { ClassifiedsOfferChatService } from './classifieds-offer-chat.service';");
  }
  if (!source.includes('    ClassifiedsOfferChatService,')) {
    source = source.replace('    ClassifiedsMarketplacePaymentsService,', '    ClassifiedsMarketplacePaymentsService,\n    ClassifiedsOfferChatService,');
  }
  if (!source.includes('ClassifiedsOfferChatService,')) throw new Error('Offer chat provider missing.');
  return source;
});

patch('backend/src/classifieds/classifieds-private.controller.ts', (input) => {
  let source = input;
  if (!source.includes("./classifieds-offer-chat.service")) {
    source = source.replace("import { ClassifiedsIdentityService } from './classifieds-identity.service';", "import { ClassifiedsIdentityService } from './classifieds-identity.service';\nimport { ClassifiedsOfferChatService } from './classifieds-offer-chat.service';");
  }
  if (!source.includes('private readonly offerChat: ClassifiedsOfferChatService')) {
    source = source.replace('    private readonly auctions: ClassifiedsAuctionService,\n    private readonly chatGateway: ChatGateway,', '    private readonly auctions: ClassifiedsAuctionService,\n    private readonly offerChat: ClassifiedsOfferChatService,\n    private readonly chatGateway: ChatGateway,');
  }

  const createOld = `  async createOffer(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {\n    await this.auctions.assertOffersAllowed(listingId);\n    return this.commerce.createOffer(req.user.uid, listingId, body?.amount);\n  }`;
  const createNew = `  async createOffer(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {\n    await this.auctions.assertOffersAllowed(listingId);\n    const offer = await this.commerce.createOffer(req.user.uid, listingId, body?.amount);\n    const event = offer?.offerEvent === 'UPDATED' ? 'UPDATED' : 'CREATED';\n    const chat = offer?.id ? await this.offerChat.record(req.user.uid, offer.id, event) : null;\n    if (chat?.message) this.chatGateway.publishMessage(chat.message, chat.recipientIds);\n    return { ...offer, conversationId: chat?.conversationId || null };\n  }`;
  if (!source.includes(createNew)) {
    if (!source.includes(createOld)) throw new Error('Create offer controller anchor missing.');
    source = source.replace(createOld, createNew);
  }

  const respondOld = `  @Post('me/offers/:offerId/respond')\n  respondOffer(@Req() req: any, @Param('offerId') offerId: string, @Body() body: any) {\n    return this.commerce.respondOffer(req.user.uid, offerId, body?.decision);\n  }`;
  const respondNew = `  @Post('me/offers/:offerId/respond')\n  async respondOffer(@Req() req: any, @Param('offerId') offerId: string, @Body() body: any) {\n    const result = await this.commerce.respondOffer(req.user.uid, offerId, body?.decision);\n    const event = String(body?.decision || '').toUpperCase().startsWith('ACCEPT') ? 'ACCEPTED' : 'REJECTED';\n    const chat = await this.offerChat.record(req.user.uid, offerId, event);\n    if (chat?.message) this.chatGateway.publishMessage(chat.message, chat.recipientIds);\n    return { ...result, conversationId: chat?.conversationId || null };\n  }`;
  if (!source.includes(respondNew)) {
    if (!source.includes(respondOld)) throw new Error('Respond offer controller anchor missing.');
    source = source.replace(respondOld, respondNew);
  }

  const withdrawOld = `  @Post('me/offers/:offerId/withdraw')\n  withdrawOffer(@Req() req: any, @Param('offerId') offerId: string) {\n    return this.commerce.withdrawOffer(req.user.uid, offerId);\n  }`;
  const withdrawNew = `  @Post('me/offers/:offerId/withdraw')\n  async withdrawOffer(@Req() req: any, @Param('offerId') offerId: string) {\n    const result = await this.commerce.withdrawOffer(req.user.uid, offerId);\n    const chat = await this.offerChat.record(req.user.uid, offerId, 'WITHDRAWN');\n    if (chat?.message) this.chatGateway.publishMessage(chat.message, chat.recipientIds);\n    return { ...result, conversationId: chat?.conversationId || null };\n  }`;
  if (!source.includes(withdrawNew)) {
    if (!source.includes(withdrawOld)) throw new Error('Withdraw offer controller anchor missing.');
    source = source.replace(withdrawOld, withdrawNew);
  }

  if (!source.includes('offerChat.record') || !source.includes('ClassifiedsOfferChatService')) throw new Error('Offer chat controller integration incomplete.');
  return source;
});

patch('backend/src/classifieds/classifieds-commerce.service.ts', (input) => {
  let source = input;
  const oldReturn = `    return this.decorateOffer(rows[0], listing, identity.type === 'COMPANY' ? 'BUYER' : 'BUYER');`;
  const newReturn = `    return { ...this.decorateOffer(rows[0], listing, 'BUYER'), offerEvent: existing[0] ? 'UPDATED' : 'CREATED' };`;
  if (!source.includes(newReturn)) {
    if (!source.includes(oldReturn)) throw new Error('Offer create result anchor missing.');
    source = source.replace(oldReturn, newReturn);
  }

  const imageJoin = `           LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE \"listingId\" = l.id ORDER BY \"sortOrder\" ASC LIMIT 1) i ON true`;
  const conversationJoin = `${imageJoin}\n           LEFT JOIN LATERAL (\n             SELECT id FROM classified_conversations\n             WHERE \"listingId\" = o.\"listingId\" AND \"buyerUserId\" = o.\"buyerUserId\"\n               AND ((\"buyerCompanyId\" IS NULL AND o.\"buyerCompanyId\" IS NULL) OR \"buyerCompanyId\" = o.\"buyerCompanyId\")\n             ORDER BY \"createdAt\" DESC LIMIT 1\n           ) conv ON true`;
  if (!source.includes('conv.id AS "conversationId"')) {
    source = source.replaceAll('                  i.url AS image,', '                  i.url AS image, conv.id AS "conversationId",');
  }
  if (!source.includes(') conv ON true')) {
    source = source.replaceAll(imageJoin, conversationJoin);
  }
  if (!source.includes('offerEvent: existing[0]') || !source.includes('conv.id AS "conversationId"') || !source.includes(') conv ON true')) throw new Error('Offer conversation/history integration missing.');
  return source;
});

console.log('Classified offers are mirrored into chat history and expose their negotiation conversation.');
