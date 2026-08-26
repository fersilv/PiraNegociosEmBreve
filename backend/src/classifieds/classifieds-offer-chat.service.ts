import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type ClassifiedOfferChatEvent = 'CREATED' | 'UPDATED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

@Injectable()
export class ClassifiedsOfferChatService {
  constructor(private readonly dataSource: DataSource) {}

  async record(uid: string, offerId: string, event: ClassifiedOfferChatEvent) {
    const rows = await this.dataSource.query(
      `SELECT o.*, l.title,
              COALESCE(bc.name, bu."socialName", bu."displayName", bu."fullName", 'Comprador') AS "buyerName",
              COALESCE(sc.name, su."socialName", su."displayName", su."fullName", 'Vendedor') AS "sellerName"
       FROM classified_offers o
       JOIN classified_listings l ON l.id=o."listingId"
       LEFT JOIN users bu ON bu.id=o."buyerUserId"
       LEFT JOIN companies bc ON bc.id=o."buyerCompanyId"
       LEFT JOIN users su ON su.id=o."sellerUserId"
       LEFT JOIN companies sc ON sc.id=o."sellerCompanyId"
       WHERE o.id=$1 LIMIT 1`,
      [offerId],
    );
    const offer = rows[0];
    if (!offer) return null;

    let conversations = await this.dataSource.query(
      `SELECT * FROM classified_conversations
       WHERE "listingId"=$1 AND "buyerUserId"=$2
         AND (("buyerCompanyId" IS NULL AND $3::uuid IS NULL) OR "buyerCompanyId"=$3)
       ORDER BY "createdAt" ASC LIMIT 1`,
      [offer.listingId, offer.buyerUserId, offer.buyerCompanyId || null],
    );
    if (!conversations[0]) {
      conversations = await this.dataSource.query(
        `INSERT INTO classified_conversations
          ("listingId","buyerUserId","buyerCompanyId","sellerUserId","sellerCompanyId","buyerLastReadAt","sellerLastReadAt","lastMessageAt")
         VALUES ($1,$2,$3,$4,$5,now(),NULL,now()) RETURNING *`,
        [offer.listingId, offer.buyerUserId, offer.buyerCompanyId || null, offer.sellerUserId, offer.sellerCompanyId || null],
      );
    }
    const conversation = conversations[0];
    const buyerEvent = event === 'CREATED' || event === 'UPDATED' || event === 'WITHDRAWN';
    const senderRole = buyerEvent ? 'BUYER' : 'SELLER';
    const senderName = buyerEvent ? offer.buyerName : offer.sellerName;
    const amount = Number(offer.amount || 0);
    const statusText = ({ CREATED: 'enviou uma oferta', UPDATED: 'atualizou a oferta', ACCEPTED: 'aceitou a oferta', REJECTED: 'recusou a oferta', WITHDRAWN: 'retirou a oferta' } as Record<ClassifiedOfferChatEvent,string>)[event];
    const body = `${senderName} ${statusText}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}.`;
    const messages = await this.dataSource.query(
      `INSERT INTO classified_conversation_messages
        ("conversationId","senderId","senderName","senderRole",body,"messageType",metadata)
       VALUES ($1,$2,$3,$4,$5,'OFFER',$6::jsonb) RETURNING *`,
      [conversation.id, uid, senderName, senderRole, body, JSON.stringify({ type: 'OFFER', event, offerId: offer.id, listingId: offer.listingId, amount, status: offer.status })],
    );
    await this.dataSource.query(`UPDATE classified_conversations SET "lastMessageAt"=now(),"updatedAt"=now() WHERE id=$1`, [conversation.id]);
    return {
      conversationId: conversation.id,
      message: messages[0] || null,
      recipientIds: [offer.buyerUserId, offer.sellerUserId].filter((id: string) => id && id !== uid),
    };
  }
}
