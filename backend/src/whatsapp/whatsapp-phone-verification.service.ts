import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  TooManyRequestsException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { WhatsAppPhoneOtp } from './entities/whatsapp-concierge.entity';
import { WhatsAppInstance } from './entities/whatsapp-instance.entity';
import { WhatsAppService } from './whatsapp.service';

@Injectable()
export class WhatsAppPhoneVerificationService {
  private readonly logger = new Logger(WhatsAppPhoneVerificationService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(WhatsAppInstance) private readonly instances: Repository<WhatsAppInstance>,
    @InjectRepository(WhatsAppPhoneOtp) private readonly otps: Repository<WhatsAppPhoneOtp>,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async status(userId: string) {
    const user = await this.requireUser(userId);
    return {
      verified: Boolean(user.whatsappVerifiedAt && user.whatsappPhoneE164),
      phoneE164: user.whatsappPhoneE164,
      whatsappId: user.whatsappId,
      verifiedAt: user.whatsappVerifiedAt,
    };
  }

  async request(userId: string, rawPhone: string) {
    const user = await this.requireUser(userId);
    const phoneE164 = this.canonicalBrazilPhone(rawPhone);
    if (!phoneE164) throw new BadRequestException('Informe um telefone brasileiro válido com DDD.');

    const existingOwner = await this.users.findOne({ where: { whatsappPhoneE164: phoneE164 } });
    if (existingOwner && existingOwner.id !== user.id) {
      throw new ConflictException('Este WhatsApp já está validado em outra conta.');
    }

    const recent = await this.otps.count({
      where: {
        userId,
        phoneE164,
        verifiedAt: IsNull(),
        createdAt: MoreThan(new Date(Date.now() - 10 * 60 * 1000)),
      },
    });
    if (recent >= 3) throw new TooManyRequestsException('Aguarde alguns minutos antes de solicitar outro código.');

    const instance = await this.primaryInstance();
    const check: any = await this.whatsapp.checkNumberStatus(instance.id, phoneE164);
    if (!check?.numberExists || !check?.canReceiveMessage) {
      throw new BadRequestException('Este número não foi localizado como uma conta do WhatsApp apta a receber mensagens. Confira o DDD e o telefone.');
    }
    const whatsappId = this.extractWhatsappId(check) || `${phoneE164}@c.us`;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = this.hashCode(userId, phoneE164, code);

    const otp = await this.otps.save(this.otps.create({
      userId,
      instanceId: instance.id,
      phoneE164,
      whatsappId,
      codeHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verifiedAt: null,
    }));

    try {
      await this.whatsapp.sendText(instance.id, whatsappId, `Seu código de confirmação do PiraNegócios é ${code}. Ele expira em 10 minutos. Não compartilhe este código.`);
    } catch (error) {
      await this.otps.remove(otp).catch(() => undefined);
      throw error;
    }

    return {
      ok: true,
      phone: this.mask(phoneE164),
      expiresAt: otp.expiresAt,
      message: 'Enviamos um código de 6 dígitos para este WhatsApp.',
    };
  }

  async verify(userId: string, rawPhone: string, rawCode: string) {
    const user = await this.requireUser(userId);
    const phoneE164 = this.canonicalBrazilPhone(rawPhone);
    const code = String(rawCode || '').replace(/\D+/g, '');
    if (!phoneE164 || code.length !== 6) throw new BadRequestException('Telefone ou código inválido.');

    const otp = await this.otps.findOne({
      where: { userId, phoneE164, verifiedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!otp || otp.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('O código expirou. Solicite um novo código.');
    }
    if (otp.attempts >= 5) throw new TooManyRequestsException('Este código foi bloqueado após muitas tentativas. Solicite outro.');

    otp.attempts += 1;
    const supplied = Buffer.from(this.hashCode(userId, phoneE164, code));
    const expected = Buffer.from(otp.codeHash);
    const valid = supplied.length === expected.length && timingSafeEqual(supplied, expected);
    if (!valid) {
      await this.otps.save(otp);
      throw new BadRequestException('Código incorreto.');
    }

    const existingOwner = await this.users.findOne({ where: { whatsappPhoneE164: phoneE164 } });
    if (existingOwner && existingOwner.id !== user.id) {
      throw new ConflictException('Este WhatsApp já está validado em outra conta.');
    }

    let whatsappId = otp.whatsappId || `${phoneE164}@c.us`;
    try {
      const mapping = await this.whatsapp.resolvePnLid(otp.instanceId, whatsappId);
      whatsappId = this.serializeWid(mapping?.lid) || this.serializeWid(mapping?.phoneNumber) || whatsappId;
    } catch {
      // A confirmação continua válida mesmo se o cache LID/PN não estiver disponível.
    }

    user.phone = phoneE164;
    user.whatsappPhoneE164 = phoneE164;
    user.whatsappId = whatsappId;
    user.whatsappVerifiedAt = new Date();
    await this.users.save(user);
    otp.verifiedAt = new Date();
    await this.otps.save(otp);

    return {
      ok: true,
      verified: true,
      phoneE164,
      whatsappId,
      verifiedAt: user.whatsappVerifiedAt,
    };
  }

  private async primaryInstance() {
    const primary = await this.instances.findOne({ where: { isPrimarySupport: true, active: true } });
    if (primary) return primary;
    const active = await this.instances.find({ where: { active: true } });
    if (active.length === 1) return active[0];
    throw new NotFoundException('Defina no painel qual número do WhatsApp é o atendimento oficial do PiraNegócios.');
  }

  private async requireUser(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  private canonicalBrazilPhone(value: string) {
    let digits = String(value || '').replace(/\D+/g, '');
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = `55${digits}`;
    if (!digits.startsWith('55') || ![12, 13].includes(digits.length)) return null;
    return digits;
  }

  private extractWhatsappId(value: any) {
    return this.serializeWid(value?.id || value?.wid || value?.phoneNumber || value?.contact?.id);
  }

  private serializeWid(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value?._serialized === 'string') return value._serialized;
    if (value?.user && value?.server) return `${value.user}@${value.server}`;
    const text = String(value);
    return text === '[object Object]' ? '' : text;
  }

  private hashCode(userId: string, phone: string, code: string) {
    const secret = String(process.env.WHATSAPP_OTP_SECRET || process.env.JWT_SECRET || '').trim();
    if (!secret) this.logger.warn('WHATSAPP_OTP_SECRET não configurado; configure um segredo forte no ambiente de produção.');
    return createHash('sha256').update(`${secret}:${userId}:${phone}:${code}`).digest('hex');
  }

  private mask(phone: string) {
    return phone.length > 6 ? `${phone.slice(0, 4)}••••${phone.slice(-4)}` : phone;
  }
}
