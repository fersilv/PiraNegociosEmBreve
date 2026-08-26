const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);
const file = 'pages/ClassifiedListingPage.tsx';
let source = fs.readFileSync(file, 'utf8');
const original = source;

function swap(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Classifieds commerce display missing ${label}`);
  source = source.replace(from, to);
}

swap(
  "import { ClassifiedListingCard, classifiedPrice } from '../components/classifieds/ClassifiedListingCard';",
  "import { ClassifiedListingCard, classifiedCommercePricing, classifiedPrice } from '../components/classifieds/ClassifiedListingCard';",
  'public pricing import',
);

swap(
  '<p className="mt-3 text-3xl font-black tracking-[-.035em] text-[#2d211c] sm:text-4xl">{classifiedPrice(listing)}</p>',
  '<PublicPriceSummary listing={listing} />',
  'public price summary',
);

const marker = `function Gallery({ images, title, selected, setSelected }:`;
if (!source.includes('function PublicPriceSummary(')) {
  if (!source.includes(marker)) throw new Error('Classifieds commerce display missing Gallery marker.');
  const component = `function PublicPriceSummary({ listing }: { listing: ClassifiedListing }) {\n  const pricing = classifiedCommercePricing(listing);\n  if (listing.priceType === 'CONTACT') return <p className="mt-3 text-3xl font-black tracking-[-.035em] text-[#2d211c] sm:text-4xl">{classifiedPrice(listing)}</p>;\n  const pix = listing.commerceConfig?.paymentPricing?.pix;\n  const card = listing.commerceConfig?.paymentPricing?.card;\n  const pixSpecial = pix?.enabled && pricing.pixPrice != null && pricing.currentPrice != null && pricing.pixPrice < pricing.currentPrice;\n  return <div className="mt-3">{pricing.promotionActive && pricing.basePrice != null && <div className="mb-1.5 flex items-center gap-2"><span className="rounded-full bg-[#d45442] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-white">Oferta</span><span className="text-sm font-bold text-[#9b8275] line-through">{commerceMoney(pricing.basePrice)}</span></div>}<p className={\`text-3xl font-black tracking-[-.035em] sm:text-4xl \${pricing.promotionActive ? 'text-[#b74435]' : 'text-[#2d211c]'}\`}>{classifiedPrice(listing)}</p>{pricing.promotionActive && pricing.promotionEndsAt && <p className="mt-1.5 text-[10px] font-black text-[#b74435]">Oferta até {new Date(pricing.promotionEndsAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>}{pixSpecial && <p className="mt-2 text-sm font-black text-emerald-700">{commerceMoney(pricing.pixPrice)} no Pix</p>}{card?.enabled && pricing.cardPrice != null && <p className="mt-1 text-xs font-bold text-[#806b60]">Cartão: {commerceMoney(pricing.cardPrice)} · até {pricing.maxInstallments}x{pricing.interestFreeInstallments > 0 ? \` · \${pricing.interestFreeInstallments}x sem juros\` : ''}</p>}{listing.commerceConfig?.onlineCheckout?.enabled && <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.1em] text-blue-700">Recebimento online habilitado</span>}</div>;\n}\n\nfunction commerceMoney(value: unknown) { const number = Number(value); return Number.isFinite(number) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number) : '—'; }\n\n`;
  source = source.replace(marker, component + marker);
}

if (source !== original) {
  fs.writeFileSync(file, source);
  console.log(`updated ${file}`);
}
console.log('Classifieds public commerce pricing verified.');
