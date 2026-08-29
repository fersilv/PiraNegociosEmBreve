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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyPlansOverviewService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const company_plans_service_1 = require("./company-plans.service");
let CompanyPlansOverviewService = class CompanyPlansOverviewService {
    dataSource;
    plans;
    constructor(dataSource, plans) {
        this.dataSource = dataSource;
        this.plans = plans;
    }
    async getForUser(userId) {
        const company = await this.plans.managedCompany(userId);
        let degraded = false;
        let payload;
        try {
            payload = await this.plans.getForUser(userId);
        }
        catch (error) {
            if (!this.isSchemaGap(error))
                throw error;
            degraded = true;
            payload = this.fallback(company);
        }
        const current = payload.current || this.freeCurrent();
        const basePlan = this.normalizePlan(current.basePlan || current.plan);
        const currentCatalog = (payload.plans || []).find((plan) => plan.id === basePlan)
            || company_plans_service_1.COMPANY_PLAN_CATALOG.find((plan) => plan.id === basePlan)
            || company_plans_service_1.COMPANY_PLAN_CATALOG[0];
        const [subscription, latestCheckout] = await Promise.all([
            this.subscription(company.id),
            this.plans.latestCheckout(userId).catch((error) => {
                if (this.isSchemaGap(error))
                    return null;
                throw error;
            }),
        ]);
        const configuredPriceCents = Number(currentCatalog?.effectivePriceCents
            ?? currentCatalog?.priceCents
            ?? 0);
        const storedPriceCents = this.firstMoney(subscription?.amountCents, subscription?.priceCents, subscription?.monthlyPriceCents, subscription?.metadata?.priceCents);
        const priceCents = storedPriceCents ?? configuredPriceCents;
        const cancelAtPeriodEnd = Boolean(current.cancelAtPeriodEnd || subscription?.cancelAtPeriodEnd);
        const periodStart = current.currentPeriodStart || subscription?.currentPeriodStart || null;
        const periodEnd = current.currentPeriodEnd || subscription?.currentPeriodEnd || null;
        const paidPeriodEnd = current.paidCurrentPeriodEnd || subscription?.currentPeriodEnd || null;
        const isTrial = Boolean(current.isTrial);
        const hasPaidSubscription = Boolean(current.hasPaidSubscription || subscription);
        const renewable = hasPaidSubscription && !cancelAtPeriodEnd;
        const nextChargeAt = cancelAtPeriodEnd
            ? null
            : isTrial
                ? current.trialEndsAt || periodEnd
                : hasPaidSubscription
                    ? paidPeriodEnd || periodEnd
                    : null;
        const nextChargeCents = nextChargeAt ? priceCents : null;
        return {
            ...payload,
            company: payload.company || { id: company.id, name: company.name },
            current,
            degraded,
            billing: {
                currency: 'BRL',
                plan: basePlan,
                planName: currentCatalog?.name || basePlan,
                status: current.status || 'FREE',
                statusLabel: this.statusLabel(current.status, isTrial, cancelAtPeriodEnd),
                priceCents,
                periodStart,
                periodEnd,
                nextChargeAt,
                nextChargeCents,
                cancelAtPeriodEnd,
                renewalEnabled: renewable,
                provider: current.provider || subscription?.provider || null,
                providerSubscriptionId: current.providerSubscriptionId || subscription?.providerSubscriptionId || null,
                isTrial,
                trialEndsAt: current.trialEndsAt || null,
                trialTargetPlan: current.trialTargetPlan || null,
                hasPaidSubscription,
                latestCheckout: latestCheckout ? {
                    id: latestCheckout.id,
                    status: latestCheckout.status || latestCheckout.paymentStatus || null,
                    productCode: latestCheckout.productCode || null,
                    productName: latestCheckout.productName || null,
                    createdAt: latestCheckout.createdAt || null,
                    paidAt: latestCheckout.paidAt || latestCheckout.approvedAt || null,
                    provider: latestCheckout.provider || latestCheckout.paymentProvider || null,
                } : null,
            },
            scopes: this.planScopes(basePlan),
            warnings: degraded
                ? ['A estrutura de cobrança deste ambiente ainda não foi migrada. O catálogo permanece disponível, mas dados de assinatura e cobrança podem estar temporariamente incompletos.']
                : [],
        };
    }
    async subscription(companyId) {
        try {
            const rows = await this.dataSource.query(`SELECT * FROM company_plan_subscriptions
         WHERE "companyId"=$1
         ORDER BY "createdAt" DESC
         LIMIT 1`, [companyId]);
            return rows[0] || null;
        }
        catch (error) {
            if (this.isSchemaGap(error))
                return null;
            throw error;
        }
    }
    fallback(company) {
        const current = this.freeCurrent();
        return {
            company: { id: company.id, name: company.name },
            current,
            trial: {
                days: 15,
                active: false,
                eligibleOnSubscription: true,
                used: false,
                targetPlan: null,
                startedAt: null,
                endsAt: null,
                restrictions: [],
            },
            plans: company_plans_service_1.COMPANY_PLAN_CATALOG.map((plan) => ({
                ...plan,
                current: plan.id === 'FREE',
                available: true,
                includesEliteTrial: plan.id !== 'FREE',
                eliteTrialDays: plan.id !== 'FREE' ? 15 : 0,
            })),
        };
    }
    freeCurrent() {
        return {
            plan: 'FREE',
            basePlan: 'FREE',
            rank: 0,
            active: false,
            status: 'FREE',
            currentPeriodStart: null,
            currentPeriodEnd: null,
            paidCurrentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            provider: null,
            providerSubscriptionId: null,
            isSimulation: false,
            isTrial: false,
            trialEndsAt: null,
            trialTargetPlan: null,
            hasPaidSubscription: false,
            advertisingEligible: false,
            jobHighlightEligible: false,
        };
    }
    normalizePlan(value) {
        const plan = String(value || '').toUpperCase();
        return plan === 'ELITE' ? 'ELITE' : plan === 'PLUS' ? 'PLUS' : 'FREE';
    }
    firstMoney(...values) {
        for (const value of values) {
            const number = Number(value);
            if (Number.isFinite(number) && number >= 0)
                return Math.round(number);
        }
        return null;
    }
    statusLabel(status, isTrial, cancelAtPeriodEnd) {
        if (isTrial)
            return 'Período gratuito';
        if (cancelAtPeriodEnd)
            return 'Cancelamento agendado';
        const value = String(status || '').toUpperCase();
        if (value === 'ACTIVE')
            return 'Ativo';
        if (value === 'PAST_DUE')
            return 'Pagamento pendente';
        if (value === 'EXPIRED')
            return 'Expirado';
        return 'Gratuito';
    }
    planScopes(plan) {
        return {
            recruitment: {
                label: 'Recrutamento',
                summary: plan === 'FREE'
                    ? 'Operações essenciais pelo WhatsApp e painel web da empresa.'
                    : plan === 'PLUS'
                        ? 'Mais gestão de vagas e candidatos pelo WhatsApp.'
                        : 'Gestão avançada de recrutamento pelo WhatsApp e benefícios promocionais pagos.',
            },
            marketplace: {
                label: 'Marketplace',
                photoLimit: 10,
                onlineSales: true,
                auctionCreation: plan === 'ELITE',
                summary: plan === 'ELITE'
                    ? 'Anúncios empresariais, vendas online e criação de leilões.'
                    : 'Anúncios empresariais e vendas online; criação de leilões exige Elite.',
            },
        };
    }
    isSchemaGap(error) {
        const code = String(error?.code || error?.driverError?.code || '');
        if (['42P01', '42703', '42883'].includes(code))
            return true;
        const message = String(error?.message || error?.driverError?.message || '').toLowerCase();
        return (message.includes('does not exist') &&
            (message.includes('company_plan_') || message.includes('payment_products') || message.includes('payments')));
    }
};
exports.CompanyPlansOverviewService = CompanyPlansOverviewService;
exports.CompanyPlansOverviewService = CompanyPlansOverviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        company_plans_service_1.CompanyPlansService])
], CompanyPlansOverviewService);
//# sourceMappingURL=company-plans-overview.service.js.map