const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

const file = 'pages/AdminDashboard.tsx';
let source = fs.readFileSync(file, 'utf8');
const original = source;

const modalStart = source.indexOf('function Modal({');
const actionsStart = source.indexOf('function Actions(', modalStart);
if (modalStart < 0 || actionsStart < 0) {
  throw new Error('Admin modal layout could not locate Modal/Actions helpers.');
}

if (!source.includes('data-admin-modal-layout="viewport-safe"')) {
  const replacement = `function Modal({\n  title,\n  onClose,\n  children,\n  wide = false,\n}: {\n  title: string;\n  onClose: () => void;\n  children: React.ReactNode;\n  wide?: boolean;\n}) {\n  useEffect(() => {\n    const previousOverflow = document.body.style.overflow;\n    document.body.style.overflow = "hidden";\n    const handleKeyDown = (event: KeyboardEvent) => {\n      if (event.key === "Escape") onClose();\n    };\n    window.addEventListener("keydown", handleKeyDown);\n    return () => {\n      document.body.style.overflow = previousOverflow;\n      window.removeEventListener("keydown", handleKeyDown);\n    };\n  }, [onClose]);\n\n  return (\n    <div\n      data-admin-modal-layout="viewport-safe"\n      className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden bg-stone-950/55 px-3 py-3 backdrop-blur-[1px] sm:px-6 sm:py-6 lg:py-8"\n      role="dialog"\n      aria-modal="true"\n      aria-label={title}\n      onMouseDown={(event) => {\n        if (event.target === event.currentTarget) onClose();\n      }}\n    >\n      <div\n        className={\`flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:max-h-[calc(100dvh-3rem)] lg:max-h-[calc(100dvh-4rem)] \${wide ? "max-w-5xl" : "max-w-2xl"}\`}\n      >\n        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-stone-200 bg-white px-4 py-3 sm:px-6 sm:py-4">\n          <div className="min-w-0">\n            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-400">Gerenciamento</p>\n            <h2 className="truncate font-serif text-xl font-bold text-stone-900">\n              {title}\n            </h2>\n          </div>\n          <button\n            type="button"\n            onClick={onClose}\n            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 shadow-sm transition hover:bg-stone-100 hover:text-stone-900"\n            aria-label="Fechar"\n          >\n            <X className="h-5 w-5" />\n          </button>\n        </div>\n        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">\n          {children}\n        </div>\n      </div>\n    </div>\n  );\n}\n`;
  source = source.slice(0, modalStart) + replacement + source.slice(actionsStart);
}

const companyModalAnchor = `        <Modal\n          title={companyDetail.company.name}\n          onClose={() => setCompanyDetail(null)}\n        >`;
const companyModalWide = `        <Modal\n          title={companyDetail.company.name}\n          onClose={() => setCompanyDetail(null)}\n          wide\n        >`;
if (!source.includes(companyModalWide)) {
  if (!source.includes(companyModalAnchor)) {
    throw new Error('Admin modal layout could not locate company detail modal.');
  }
  source = source.replace(companyModalAnchor, companyModalWide);
}

if (!source.includes('data-admin-modal-layout="viewport-safe"')) {
  throw new Error('Admin viewport-safe modal layout was not applied.');
}
if (!source.includes('onClose={() => setCompanyDetail(null)}\n          wide')) {
  throw new Error('Admin company detail modal was not widened.');
}

if (source !== original) {
  fs.writeFileSync(file, source);
  console.log(`updated ${file}`);
}
console.log('Admin viewport-safe modal layout verified.');
