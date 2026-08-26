const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

const file = 'backend/src/company-plans/company-plans.service.ts';
let source = fs.readFileSync(file, 'utf8');
const original = source;

const productsMarker = 'const planProducts = new Map<CompanyPlan, any>';
const pricingMarker = "effectivePriceCents: plan.id === 'FREE' ? 0 : Number(product?.effectivePriceCents";

if (!source.includes(productsMarker)) {
  const loadAnchor = `    const [current, trialRecord] = await Promise.all([\n      this.getCompanyPlan(company.id),\n      this.trialForCompany(company.id),\n    ]);\n    const trialUsed = Boolean(trialRecord);`;
  if (!source.includes(loadAnchor)) throw new Error('Company plan dynamic pricing load anchor not found.');
  source = source.replace(
    loadAnchor,
    `    const [current, trialRecord, plusProduct, eliteProduct] = await Promise.all([\n      this.getCompanyPlan(company.id),\n      this.trialForCompany(company.id),\n      this.payments.findProduct('COMPANY_PLUS_MONTHLY', true).catch(() => null),\n      this.payments.findProduct('COMPANY_ELITE_MONTHLY', true).catch(() => null),\n    ]);\n    const planProducts = new Map<CompanyPlan, any>([['PLUS', plusProduct], ['ELITE', eliteProduct]]);\n    const trialUsed = Boolean(trialRecord);`,
  );
}

if (!source.includes(pricingMarker)) {
  const plansAnchor = `      plans: COMPANY_PLAN_CATALOG.map((plan) => ({\n        ...plan,\n        current: !current.isTrial && current.basePlan === plan.id,\n        available: RANK[plan.id] >= RANK[current.basePlan] || plan.id === current.basePlan,\n        includesEliteTrial: plan.id !== 'FREE' && trialEligibleOnSubscription,\n        eliteTrialDays: plan.id !== 'FREE' && trialEligibleOnSubscription ? ELITE_TRIAL_DAYS : 0,\n      })),`;
  if (!source.includes(plansAnchor)) throw new Error('Company plan dynamic pricing catalog anchor not found.');
  source = source.replace(
    plansAnchor,
    `      plans: COMPANY_PLAN_CATALOG.map((plan) => {\n        const product = plan.id === 'FREE' ? null : planProducts.get(plan.id);\n        return {\n          ...plan,\n          priceCents: plan.id === 'FREE' ? 0 : Number(product?.priceCents ?? plan.priceCents ?? 0),\n          originalPriceCents: plan.id === 'FREE' ? 0 : Number(product?.originalPriceCents ?? product?.priceCents ?? plan.priceCents ?? 0),\n          effectivePriceCents: plan.id === 'FREE' ? 0 : Number(product?.effectivePriceCents ?? product?.priceCents ?? plan.priceCents ?? 0),\n          promotionalPriceCents: plan.id === 'FREE' ? null : product?.promotionalPriceCents ?? null,\n          promotionActive: plan.id === 'FREE' ? false : Boolean(product?.promotionActive),\n          current: !current.isTrial && current.basePlan === plan.id,\n          available: RANK[plan.id] >= RANK[current.basePlan] || plan.id === current.basePlan,\n          includesEliteTrial: plan.id !== 'FREE' && trialEligibleOnSubscription,\n          eliteTrialDays: plan.id !== 'FREE' && trialEligibleOnSubscription ? ELITE_TRIAL_DAYS : 0,\n        };\n      }),`,
  );
}

if (!source.includes(productsMarker)) throw new Error('Company plan products were not loaded dynamically.');
if (!source.includes(pricingMarker)) throw new Error('Company plan dynamic pricing was not applied.');

if (source !== original) {
  fs.writeFileSync(file, source);
  console.log(`updated ${file}`);
}
console.log('Company plan dynamic pricing verified.');
