"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var WhatsAppPhoneVerificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppPhoneVerificationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/entities/user.entity");
const whatsapp_concierge_entity_1 = require("./entities/whatsapp-concierge.entity");
const whatsapp_instance_entity_1 = require("./entities/whatsapp-instance.entity");
const whatsapp_service_1 = require("./whatsapp.service");
let WhatsAppPhoneVerificationService = WhatsAppPhoneVerificationService_1 = class WhatsAppPhoneVerificationService {
    users;
    instances;
    otps;
    whatsapp;
    logger = new common_1.Logger(WhatsAppPhoneVerificationService_1.name);
    constructor(users, instances, otps, whatsapp) {
        this.users = users;
        this.instances = instances;
        this.otps = otps;
        this.whatsapp = whatsapp;
    }
    async status(userId) {
        const user = await this.requireUser(userId);
        return {
            verified: Boolean(user.whatsappVerifiedAt && user.whatsappPhoneE164),
            phoneE164: user.whatsappPhoneE164,
            whatsappId: user.whatsappId,
            verifiedAt: user.whatsappVerifiedAt,
        };
    }
    async request(userId, rawPhone) {
        const user = await this.requireUser(userId);
        const phoneE164 = this.canonicalBrazilPhone(rawPhone);
        if (!phoneE164)
            throw new common_1.BadRequestException('Informe um telefone brasileiro válido com DDD.');
        const existingOwner = await this.users.findOne({ where: { whatsappPhoneE164: phoneE164 } });
        if (existingOwner && existingOwner.id !== user.id) {
            throw new common_1.ConflictException('Este WhatsApp já está validado em outra conta.');
        }
        const recent = await this.otps.count({
            where: {
                userId,
                phoneE164,
                verifiedAt: (0, typeorm_2.IsNull)(),
                createdAt: (0, typeorm_2.MoreThan)(new Date(Date.now() - 10 * 60 * 1000)),
            },
        });
        if (recent >= 3) {
            throw new common_1.HttpException('Aguarde alguns minutos antes de solicitar outro código.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const instance = await this.primaryInstance();
        const check = await this.whatsapp.checkNumberStatus(instance.id, phoneE164);
        if (!check?.numberExists || !check?.canReceiveMessage) {
            throw new common_1.BadRequestException('Este número não foi localizado como uma conta do WhatsApp apta a receber mensagens. Confira o DDD e o telefone.');
        }
        const whatsappId = this.extractWhatsappId(check) || `${phoneE164}@c.us`;
        const code = String((0, crypto_1.randomInt)(0, 1_000_000)).padStart(6, '0');
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
        }
        catch (error) {
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
    async verify(userId, rawPhone, rawCode) {
        const user = await this.requireUser(userId);
        const phoneE164 = this.canonicalBrazilPhone(rawPhone);
        const code = String(rawCode || '').replace(/\D+/g, '');
        if (!phoneE164 || code.length !== 6)
            throw new common_1.BadRequestException('Telefone ou código inválido.');
        const otp = await this.otps.findOne({
            where: { userId, phoneE164, verifiedAt: (0, typeorm_2.IsNull)() },
            order: { createdAt: 'DESC' },
        });
        if (!otp || otp.expiresAt.getTime() <= Date.now()) {
            throw new common_1.BadRequestException('O código expirou. Solicite um novo código.');
        }
        if (otp.attempts >= 5) {
            throw new common_1.HttpException('Este código foi bloqueado após muitas tentativas. Solicite outro.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        otp.attempts += 1;
        const supplied = Buffer.from(this.hashCode(userId, phoneE164, code));
        const expected = Buffer.from(otp.codeHash);
        const valid = supplied.length === expected.length && (0, crypto_1.timingSafeEqual)(supplied, expected);
        if (!valid) {
            await this.otps.save(otp);
            throw new common_1.BadRequestException('Código incorreto.');
        }
        const existingOwner = await this.users.findOne({ where: { whatsappPhoneE164: phoneE164 } });
        if (existingOwner && existingOwner.id !== user.id) {
            throw new common_1.ConflictException('Este WhatsApp já está validado em outra conta.');
        }
        let whatsappId = otp.whatsappId || `${phoneE164}@c.us`;
        try {
            const mapping = await this.whatsapp.resolvePnLid(otp.instanceId, whatsappId);
            whatsappId = this.serializeWid(mapping?.lid) || this.serializeWid(mapping?.phoneNumber) || whatsappId;
        }
        catch {
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
    async primaryInstance() {
        const primary = await this.instances.findOne({ where: { isPrimarySupport: true, active: true } });
        if (primary)
            return primary;
        const active = await this.instances.find({ where: { active: true } });
        if (active.length === 1)
            return active[0];
        throw new common_1.NotFoundException('Defina no painel qual número do WhatsApp é o atendimento oficial do PiraNegócios.');
    }
    async requireUser(userId) {
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('Usuário não encontrado.');
        return user;
    }
    canonicalBrazilPhone(value) {
        let digits = String(value || '').replace(/\D+/g, '');
        if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55'))
            digits = `55${digits}`;
        if (!digits.startsWith('55') || ![12, 13].includes(digits.length))
            return null;
        return digits;
    }
    extractWhatsappId(value) {
        return this.serializeWid(value?.id || value?.wid || value?.phoneNumber || value?.contact?.id);
    }
    serializeWid(value) {
        if (!value)
            return '';
        if (typeof value === 'string')
            return value;
        if (typeof value?._serialized === 'string')
            return value._serialized;
        if (value?.user && value?.server)
            return `${value.user}@${value.server}`;
        const text = String(value);
        return text === '[object Object]' ? '' : text;
    }
    hashCode(userId, phone, code) {
        const secret = String(process.env.WHATSAPP_OTP_SECRET || process.env.JWT_SECRET || '').trim();
        if (!secret)
            this.logger.warn('WHATSAPP_OTP_SECRET não configurado; configure um segredo forte no ambiente de produção.');
        return (0, crypto_1.createHash)('sha256').update(`${secret}:${userId}:${phone}:${code}`).digest('hex');
    }
    mask(phone) {
        return phone.length > 6 ? `${phone.slice(0, 4)}••••${phone.slice(-4)}` : phone;
    }
};
exports.WhatsAppPhoneVerificationService = WhatsAppPhoneVerificationService;
exports.WhatsAppPhoneVerificationService = WhatsAppPhoneVerificationService = WhatsAppPhoneVerificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(whatsapp_instance_entity_1.WhatsAppInstance)),
    __param(2, (0, typeorm_1.InjectRepository)(whatsapp_concierge_entity_1.WhatsAppPhoneOtp)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        whatsapp_service_1.WhatsAppService])
], WhatsAppPhoneVerificationService);
//# sourceMappingURL=whatsapp-phone-verification.service.js.map