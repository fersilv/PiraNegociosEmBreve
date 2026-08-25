const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
process.chdir(repoRoot);

const file = 'components/WorkspaceLayout.tsx';
let source = fs.readFileSync(file, 'utf8');
const original = source;

const replacements = [
  [
    'className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] px-4 py-3 text-left text-xs font-bold text-white/48 transition hover:bg-white/[0.05] hover:text-white"><Tags className="h-4 w-4" />Ir para os Classificados',
    'className="flex w-full items-center gap-3 rounded-2xl border border-[#e8aa89]/30 bg-[#c96847]/18 px-4 py-3 text-left text-xs font-black text-[#ffd8c5] shadow-[0_8px_24px_rgba(0,0,0,.12)] transition hover:-translate-y-0.5 hover:bg-[#c96847]/28 hover:text-white"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#c96847] text-white"><Tags className="h-4 w-4" /></span><span className="flex-1">Ir para os Classificados</span><span className="rounded-full bg-[#c96847] px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-white">Novo</span>',
  ],
  [
    'className="hidden items-center gap-2 rounded-2xl border border-stone-200/80 bg-white/80 px-3.5 py-2.5 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-white lg:flex"><Tags className="h-4 w-4" />Classificados</Link>',
    'className="hidden items-center gap-2 rounded-2xl border border-[#c96847]/25 bg-[#fff0e8] px-4 py-2.5 text-xs font-black text-[#a84f34] shadow-[0_8px_24px_rgba(201,104,71,.16)] transition hover:-translate-y-0.5 hover:bg-[#ffe5d8] lg:flex"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#c96847] text-white"><Tags className="h-4 w-4" /></span>Classificados<span className="rounded-full bg-[#c96847] px-2 py-0.5 text-[8px] font-black uppercase tracking-[.12em] text-white">Novo</span></Link>',
  ],
  [
    'className={`flex min-w-12 flex-col items-center gap-0.5 rounded-xl px-1.5 py-1 text-[9px] font-semibold ${isCompany ? "text-stone-400" : "text-white/38"}`}><Tags className="h-5 w-5" /><span>Classificados</span></Link>',
    'className={`flex min-w-14 flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 text-[9px] font-black ${isCompany ? "border-[#c96847]/20 bg-[#fff0e8] text-[#a84f34]" : "border-[#e8aa89]/25 bg-[#c96847]/20 text-[#ffd8c5]"}`}><Tags className="h-5 w-5" /><span>Classificados</span></Link>',
  ],
];

for (const [before, after] of replacements) {
  if (source.includes(before)) source = source.replace(before, after);
}

if (!source.includes('Ir para os Classificados</span><span className="rounded-full bg-[#c96847]')) {
  throw new Error('Não foi possível aplicar o destaque dos Classificados na lateral do workspace.');
}
if (!source.includes('Classificados<span className="rounded-full bg-[#c96847]')) {
  throw new Error('Não foi possível aplicar o destaque dos Classificados no topo do workspace.');
}
if (!source.includes('flex min-w-14 flex-col items-center')) {
  throw new Error('Não foi possível aplicar o destaque dos Classificados na navegação mobile.');
}

if (source !== original) {
  fs.writeFileSync(file, source);
  console.log(`updated ${file}`);
}
console.log('Classifieds workspace navigation highlight verified.');
