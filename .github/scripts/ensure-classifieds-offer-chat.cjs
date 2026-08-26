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
  const createNew = `  async createOffer(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {\n    await this.auctions.assertOffersAllowed(listingId);\n    const offer = await this.commerce.createOffer(req.user.uid, listingId, body?.amount);\n    const chat = offer?.id ? await this.offerChat.record(req.user.uid, offer.id, 'CREATED') : null;\n    if (chat?.message) this.chatGateway.publishMessage(chat.message, chat.recipientIds);\n    return { ...offer, conversationId: chat?.conversationId || null };\n  }`;
  if (!source.includes(createNew)) {
    if (!source.includes(createOld)) throw new Error('Create offer controller anchor missing.');
    source = source.replace(createOld, createNew);
  }

  const respondOld = `  @Post('me/offers/:offerId/respond')\n  respondOffer(@Req() req: any, @Param('offerId') offerId: string, @Body() body: any) {\n    return this.commerce.respondOffer(req.user.uid, offerId, body?.decision);\n  }`;
  const respondNew = `  @Post('me/offers/:offerId/respond')\n  async respondOffer(@Req() req: any, @Param('offerId') offerId: string, @Body() body: any) {\n    const result = await this.commerce.respondOffer(req.user.uid, offerId, body?.decision);\n    const event = String(body?.decision || '').toUpperCase() === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';\n    const chat = await this.offerChat.record(req.user.uid, offerId, event);\n    if (chat?.message) this.chatGateway.publishMessage(chat.message, chat.recipientIds);\n    return { ...result, conversationId: chat?.conversationId || null };\n  }`;
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

console.log('Classified offers are mirrored into chat history.');
