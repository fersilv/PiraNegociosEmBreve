import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClassifiedsAuctionEngagementService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.process().catch((error) => console.warn('Falha no ciclo de lembretes de leilão:', error)), 30_000);
    this.timer.unref?.();
    void this.process().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async reminderStatus(uid: string, auctionId: string) {
    await this.assertAuction(auctionId);
    const rows = await this.dataSource.query(
      `SELECT enabled,"lastPresenceAt" FROM classified_auction_reminders WHERE "auctionId"=$1 AND "userId"=$2 LIMIT 1`,
      [auctionId, uid],
    ).catch(() => []);
    return { enabled: rows[0]?.enabled === true, lastPresenceAt: rows[0]?.lastPresenceAt || null };
  }

  async setReminder(uid: string, auctionId: string, enabledRaw: unknown) {
    const auction = await this.assertAuction(auctionId);
    if (!['SCHEDULED','OPEN'].includes(auction.status) || new Date(auction.endsAt).getTime() <= Date.now()) {
      throw new BadRequestException('Este leilão já terminou e não aceita novos lembretes.');
    }
    const enabled = enabledRaw !== false;
    await this.dataSource.query(
      `INSERT INTO classified_auction_reminders("auctionId","userId",enabled,"updatedAt")
       VALUES ($1,$2,$3,now())
       ON CONFLICT ("auctionId","userId") DO UPDATE SET enabled=EXCLUDED.enabled,"updatedAt"=now()`,
      [auctionId, uid, enabled],
    );
    return { enabled };
  }

  async presence(uid: string, auctionId: string) {
    const auction = await this.assertAuction(auctionId);
    if (!['SCHEDULED','OPEN'].includes(auction.status)) return { recorded: false };
    await this.dataSource.query(
      `INSERT INTO classified_auction_reminders("auctionId","userId",enabled,"lastPresenceAt","updatedAt")
       VALUES ($1,$2,false,now(),now())
       ON CONFLICT ("auctionId","userId") DO UPDATE SET "lastPresenceAt"=now(),"updatedAt"=now()`,
      [auctionId, uid],
    );
    return { recorded: true, at: new Date().toISOString() };
  }

  async process() {
    const activated = await this.activateScheduled();
    const pre = await this.sendPreStart();
    const started = await this.sendStart();
    const missed = await this.sendMissYou();
    const closed = await this.sendClosureThanks();
    return { activated, pre, started, missed, closed };
  }

  private async activateScheduled() {
    const rows = await this.dataSource.query(
      `UPDATE classified_auctions
       SET status='OPEN',"updatedAt"=now()
       WHERE status='SCHEDULED' AND "startsAt" <= now() AND "endsAt" > now()
       RETURNING id`,
    ).catch(() => []);
    return rows.length;
  }

  private async sendPreStart() {
    const rows = await this.dataSource.query(
      `SELECT r.id,r."userId",a.id AS "auctionId",a."startsAt",l.title
       FROM classified_auction_reminders r
       JOIN classified_auctions a ON a.id=r."auctionId"
       JOIN classified_listings l ON l.id=a."listingId"
       WHERE r.enabled=true AND r."preStartSentAt" IS NULL
         AND a.status='SCHEDULED' AND a."startsAt" > now()
         AND a."startsAt" <= now() + interval '10 minutes'
       ORDER BY a."startsAt" ASC LIMIT 200`,
    ).catch(() => []);
    let sent = 0;
    for (const row of rows) {
      const claimed = await this.claimReminder(row.id, 'preStartSentAt');
      if (!claimed) continue;
      await this.notifications.notifyUser(row.userId, {
        title: '🔔 Seu leilão começa em 10 minutos',
        message: `“${row.title}” está quase começando. Entre na sala para acompanhar os lances desde o início.`,
        type: 'classified_auction_reminder',
        link: `/classificados/leiloes/${row.auctionId}`,
      }).catch(() => undefined);
      sent += 1;
    }
    return sent;
  }

  private async sendStart() {
    const rows = await this.dataSource.query(
      `SELECT r.id,r."userId",a.id AS "auctionId",a."startsAt",l.title
       FROM classified_auction_reminders r
       JOIN classified_auctions a ON a.id=r."auctionId"
       JOIN classified_listings l ON l.id=a."listingId"
       WHERE r.enabled=true AND r."startSentAt" IS NULL
         AND a.status='OPEN' AND a."startsAt" <= now()
         AND a."startsAt" > now() - interval '10 minutes'
         AND (r."lastPresenceAt" IS NULL OR r."lastPresenceAt" < a."startsAt")
       LIMIT 200`,
    ).catch(() => []);
    let sent = 0;
    for (const row of rows) {
      const claimed = await this.claimReminder(row.id, 'startSentAt');
      if (!claimed) continue;
      await this.notifications.notifyUser(row.userId, {
        title: '🔴 O leilão começou',
        message: `“${row.title}” já está ao vivo. Os lances estão abertos agora.`,
        type: 'classified_auction_started',
        link: `/classificados/leiloes/${row.auctionId}`,
      }).catch(() => undefined);
      sent += 1;
    }
    return sent;
  }

  private async sendMissYou() {
    const rows = await this.dataSource.query(
      `SELECT r.id,r."userId",a.id AS "auctionId",a."startsAt",l.title
       FROM classified_auction_reminders r
       JOIN classified_auctions a ON a.id=r."auctionId"
       JOIN classified_listings l ON l.id=a."listingId"
       WHERE r.enabled=true AND r."missYouSentAt" IS NULL
         AND a.status='OPEN' AND a."startsAt" <= now() - interval '10 minutes'
         AND a."startsAt" > now() - interval '25 minutes'
         AND (r."lastPresenceAt" IS NULL OR r."lastPresenceAt" < a."startsAt")
       LIMIT 200`,
    ).catch(() => []);
    let sent = 0;
    for (const row of rows) {
      const claimed = await this.claimReminder(row.id, 'missYouSentAt');
      if (!claimed) continue;
      await this.notifications.notifyUser(row.userId, {
        title: '👀 Estamos sentindo sua falta',
        message: `O leilão “${row.title}” já começou e você pediu para ser lembrado. Ainda dá tempo de acompanhar.`,
        type: 'classified_auction_miss_you',
        link: `/classificados/leiloes/${row.auctionId}`,
      }).catch(() => undefined);
      sent += 1;
    }
    return sent;
  }

  private async sendClosureThanks() {
    const auctions = await this.dataSource.query(
      `SELECT a.id,a."winnerUserId",a."finalAmount",l.title
       FROM classified_auctions a JOIN classified_listings l ON l.id=a."listingId"
       WHERE a.status='ENDED'
         AND EXISTS (SELECT 1 FROM classified_auction_bids b WHERE b."auctionId"=a.id)
         AND NOT EXISTS (
           SELECT 1 FROM classified_auction_closure_notifications n
           WHERE n."auctionId"=a.id AND n.kind='PARTICIPANTS_COMPLETE'
         )
       ORDER BY a."closedAt" ASC NULLS LAST LIMIT 30`,
    ).catch(() => []);
    let done = 0;
    for (const auction of auctions) {
      const bidders = await this.dataSource.query(
        `SELECT DISTINCT "bidderUserId" AS "userId" FROM classified_auction_bids WHERE "auctionId"=$1`,
        [auction.id],
      ).catch(() => []);
      for (const bidder of bidders) {
        const winner = bidder.userId === auction.winnerUserId;
        const inserted = await this.dataSource.query(
          `INSERT INTO classified_auction_closure_notifications("auctionId","userId",kind)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
          [auction.id, bidder.userId, winner ? 'WINNER' : 'PARTICIPANT'],
        ).catch(() => []);
        if (!inserted[0]) continue;
        await this.notifications.notifyUser(bidder.userId, winner ? {
          title: '🏆 Você arrematou!',
          message: `Obrigado por participar. Você venceu “${auction.title}”. Seu lance é um compromisso de compra: entre em contato com o anunciante, combine retirada/entrega e conclua o pagamento. O descumprimento injustificado pode gerar restrições de participação conforme os termos do leilão.`,
          type: 'classified_auction_winner_commitment',
          link: `/classificados/gestao/leiloes/${auction.id}`,
        } : {
          title: '💛 Obrigado por participar do leilão',
          message: `O leilão “${auction.title}” terminou. Obrigado por fazer parte da disputa e acompanhar o PiraNegócios.`,
          type: 'classified_auction_thanks',
          link: `/classificados/leiloes/${auction.id}`,
        }).catch(() => undefined);
      }
      await this.dataSource.query(
        `INSERT INTO classified_auction_closure_notifications("auctionId","userId",kind)
         VALUES ($1,NULL,'PARTICIPANTS_COMPLETE') ON CONFLICT DO NOTHING`,
        [auction.id],
      ).catch(() => undefined);
      done += 1;
    }
    return done;
  }

  private async claimReminder(id: string, column: 'preStartSentAt' | 'startSentAt' | 'missYouSentAt') {
    const allowed = new Set(['preStartSentAt','startSentAt','missYouSentAt']);
    if (!allowed.has(column)) return false;
    const rows = await this.dataSource.query(
      `UPDATE classified_auction_reminders SET "${column}"=now(),"updatedAt"=now()
       WHERE id=$1 AND "${column}" IS NULL RETURNING id`,
      [id],
    ).catch(() => []);
    return Boolean(rows[0]);
  }

  private async assertAuction(auctionId: string) {
    const rows = await this.dataSource.query(`SELECT * FROM classified_auctions WHERE id=$1 LIMIT 1`, [auctionId]);
    if (!rows[0]) throw new NotFoundException('Leilão não encontrado.');
    return rows[0];
  }
}
