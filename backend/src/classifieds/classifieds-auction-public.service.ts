import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ClassifiedsAuctionPublicService {
  constructor(private readonly dataSource: DataSource) {}

  async list() {
    const rows = await this.dataSource.query(`
      SELECT
        a.id,a."listingId",a."companyId",a.status,a."startPrice",a."minIncrement",a."startsAt",a."endsAt",a."closedAt",a."finalAmount",a."createdAt",a."updatedAt",
        a."onlinePaymentEnabled",a."fulfillmentModes",a."deliveryFeeCents",a."deliveryNote",a."settlementPaymentStatus",
        l.title,l.slug,l.description,l.price AS "listingPrice",l.city,l.state,l.neighborhood,l.condition,l."sellerVerifiedSnapshot",
        c.name AS "companyName",c."logoURL" AS "companyLogo",i.url AS image,hb.amount AS "currentBid",COALESCE(bc."bidCount",0)::int AS "bidCount"
      FROM classified_auctions a
      JOIN classified_listings l ON l.id=a."listingId"
      JOIN companies c ON c.id=a."companyId"
      LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1) i ON true
      LEFT JOIN LATERAL (SELECT b.amount FROM classified_auction_bids b WHERE b."auctionId"=a.id ORDER BY b.amount DESC,b."createdAt" ASC LIMIT 1) hb ON true
      LEFT JOIN LATERAL (SELECT count(*) AS "bidCount" FROM classified_auction_bids b WHERE b."auctionId"=a.id) bc ON true
      WHERE a.status IN ('SCHEDULED','OPEN')
        AND a."endsAt">now()
        AND l.status='PUBLISHED'
        AND l."publicationChannels" @> '["CLASSIFIEDS"]'::jsonb
      ORDER BY CASE a.status WHEN 'OPEN' THEN 0 ELSE 1 END,a."startsAt" ASC,a."endsAt" ASC
    `);
    return rows.map((row:any)=>this.present(row));
  }

  async detail(auctionId:string) {
    const rows=await this.dataSource.query(`
      SELECT a.*,l.title,l.slug,l.description,l.price AS "listingPrice",l.city,l.state,l.neighborhood,l.condition,l."sellerVerifiedSnapshot",
             c.name AS "companyName",c."logoURL" AS "companyLogo",i.url AS image,hb.amount AS "currentBid",COALESCE(bc."bidCount",0)::int AS "bidCount"
      FROM classified_auctions a
      JOIN classified_listings l ON l.id=a."listingId"
      JOIN companies c ON c.id=a."companyId"
      LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1) i ON true
      LEFT JOIN LATERAL (SELECT b.amount FROM classified_auction_bids b WHERE b."auctionId"=a.id ORDER BY b.amount DESC,b."createdAt" ASC LIMIT 1) hb ON true
      LEFT JOIN LATERAL (SELECT count(*) AS "bidCount" FROM classified_auction_bids b WHERE b."auctionId"=a.id) bc ON true
      WHERE a.id=$1 AND l."publicationChannels" @> '["CLASSIFIEDS"]'::jsonb LIMIT 1`,[auctionId]);
    if(!rows[0])throw new NotFoundException('Leilão não encontrado.');
    const bids=await this.dataSource.query(`SELECT b.id,b.amount,b."createdAt",COALESCE(c.name,u."socialName",u."displayName",u."fullName",'Participante') AS "bidderName" FROM classified_auction_bids b LEFT JOIN companies c ON c.id=b."bidderCompanyId" LEFT JOIN users u ON u.id=b."bidderUserId" WHERE b."auctionId"=$1 ORDER BY b.amount DESC,b."createdAt" ASC LIMIT 30`,[auctionId]);
    const row=rows[0];
    return {...this.present(row),bids:bids.map((b:any)=>({id:b.id,amount:Number(b.amount),createdAt:b.createdAt,bidderName:this.maskName(b.bidderName)})),settlement:{mode:row.onlinePaymentEnabled?'ONLINE_OR_DIRECT':'DIRECT',onlinePaymentEnabled:row.onlinePaymentEnabled===true,protectedPayment:false,fulfillmentModes:this.modes(row.fulfillmentModes),deliveryFeeCents:Number(row.deliveryFeeCents||0),deliveryNote:row.deliveryNote||null,paymentStatus:row.settlementPaymentStatus||'NOT_STARTED',message:row.onlinePaymentEnabled?'Após o arremate, vencedor e anunciante podem combinar retirada/entrega e finalizar o pagamento online pelo Mercado Pago ou negociar diretamente, conforme as condições do anúncio.':'Pagamento, retirada e entrega são combinados diretamente entre vencedor e anunciante.'}};
  }

  async forListings(listingIds:string[]){
    const ids=[...new Set(listingIds.map(id=>String(id||'').trim()).filter(Boolean))].slice(0,100);if(!ids.length)return[];
    const rows=await this.dataSource.query(`SELECT a.id,a."listingId",a.status,a."startPrice",a."minIncrement",a."startsAt",a."endsAt",hb.amount AS "currentBid",COALESCE(bc."bidCount",0)::int AS "bidCount" FROM classified_auctions a LEFT JOIN LATERAL (SELECT b.amount FROM classified_auction_bids b WHERE b."auctionId"=a.id ORDER BY b.amount DESC,b."createdAt" ASC LIMIT 1) hb ON true LEFT JOIN LATERAL (SELECT count(*) AS "bidCount" FROM classified_auction_bids b WHERE b."auctionId"=a.id) bc ON true WHERE a.status IN ('SCHEDULED','OPEN') AND a."endsAt">now() AND a."listingId"=ANY($1::uuid[])`,[ids]);
    return rows.map((r:any)=>({id:r.id,listingId:r.listingId,status:r.status,startPrice:Number(r.startPrice),minIncrement:Number(r.minIncrement),currentBid:r.currentBid==null?null:Number(r.currentBid),bidCount:Number(r.bidCount||0),startsAt:r.startsAt,endsAt:r.endsAt,scheduled:r.status==='SCHEDULED'||new Date(r.startsAt).getTime()>Date.now(),live:r.status==='OPEN'&&new Date(r.startsAt).getTime()<=Date.now()&&new Date(r.endsAt).getTime()>Date.now(),nextMinimum:Number(r.currentBid==null?r.startPrice:Number(r.currentBid)+Number(r.minIncrement))}));
  }

  private present(row:any){const current=row.currentBid==null?Number(row.startPrice):Number(row.currentBid);const starts=new Date(row.startsAt).getTime();const ends=new Date(row.endsAt).getTime();return{id:row.id,listingId:row.listingId,companyId:row.companyId,status:row.status,title:row.title,slug:row.slug,description:row.description,listingPrice:row.listingPrice==null?null:Number(row.listingPrice),city:row.city,state:row.state,neighborhood:row.neighborhood,condition:row.condition,sellerVerifiedSnapshot:Boolean(row.sellerVerifiedSnapshot),companyName:row.companyName,companyLogo:row.companyLogo,image:row.image,startPrice:Number(row.startPrice),minIncrement:Number(row.minIncrement),currentBid:row.currentBid==null?null:Number(row.currentBid),bidCount:Number(row.bidCount||0),startsAt:row.startsAt,endsAt:row.endsAt,closedAt:row.closedAt,finalAmount:row.finalAmount==null?null:Number(row.finalAmount),nextMinimum:Number((row.currentBid==null?Number(row.startPrice):current+Number(row.minIncrement)).toFixed(2)),scheduled:row.status==='SCHEDULED'||starts>Date.now(),live:row.status==='OPEN'&&starts<=Date.now()&&ends>Date.now(),onlinePaymentEnabled:row.onlinePaymentEnabled===true};}
  private modes(value:unknown){const raw=Array.isArray(value)?value:[];const m=raw.map(String).map(v=>v.toUpperCase()).filter(v=>['ARRANGE','PICKUP','DELIVERY'].includes(v));return m.length?m:['ARRANGE'];}
  private maskName(value:unknown){const name=String(value||'Participante').trim();if(name.length<=2)return`${name.charAt(0)||'P'}***`;return`${name.charAt(0)}${'*'.repeat(Math.min(5,Math.max(2,name.length-2)))}${name.charAt(name.length-1)}`;}
}
