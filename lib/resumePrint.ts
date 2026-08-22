const SCREEN_FOOTER_STYLE_ID = 'resume-screen-footer-label';

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function markPrintBreakpoints(root: HTMLElement): void {
  const stageSelectors = [
    '.space-y-4 > .relative.pl-4',
    '.mt-3.space-y-4 > div',
    '.space-y-3.border-l > div',
  ];

  for (const selector of stageSelectors) {
    root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      element.classList.add('resume-print-stage');
    });
  }

  // A empresa pode continuar em outra página quando possui vários cargos,
  // mas cada cargo individual deve permanecer inteiro sempre que couber.
  root.querySelectorAll<HTMLElement>('.break-inside-avoid').forEach((element) => {
    if (element.querySelector('.resume-print-stage')) {
      element.classList.add('resume-print-splittable');
    }
  });

  root.querySelectorAll<HTMLElement>('section').forEach((section) => {
    const heading = section.querySelector<HTMLElement>('h1,h2,h3,h4');
    if (heading) heading.classList.add('resume-print-keep-with-next');
  });
}

function cloneResumeForPrint(): HTMLElement | null {
  const source = document.querySelector<HTMLElement>(
    '#resume-preview-area .resume-a4-document',
  );
  if (!source) return null;

  const clone = source.cloneNode(true) as HTMLElement;

  // O wrapper possui CSS de impressão legado. Removemos apenas esse CSS,
  // nunca os elementos ou a malha do template. O PDF deve ser visualmente
  // o mesmo currículo mostrado no preview.
  clone.querySelectorAll('style').forEach((style) => style.remove());
  clone.querySelector('.resume-brand-footer')?.remove();
  clone.classList.add('resume-print-document');
  markPrintBreakpoints(clone);
  return clone;
}

function collectHeadStyles(): string {
  return Array.from(
    document.head.querySelectorAll<HTMLElement>('style, link[rel="stylesheet"]'),
  )
    .map((node) => node.outerHTML)
    .join('\n');
}

const PRINT_CSS = `
@page {
  size: A4 portrait;
  /* Mantém os 210 mm de largura usados no preview. A margem inferior é
     reservada exclusivamente para a assinatura do PiraNegócios. */
  margin: 0 0 12mm;
}

html,
body {
  margin: 0 !important;
  padding: 0 !important;
  width: 210mm !important;
  min-width: 210mm !important;
  background: #fff !important;
  color: #292524;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

body {
  overflow: visible !important;
}

.resume-print-shell {
  width: 210mm !important;
  min-width: 210mm !important;
  max-width: 210mm !important;
  margin: 0 auto !important;
}

.resume-print-document {
  position: static !important;
  width: 210mm !important;
  min-width: 210mm !important;
  max-width: 210mm !important;
  min-height: 0 !important;
  height: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  box-shadow: none !important;
  overflow: visible !important;
  background: #fff !important;
  box-sizing: border-box !important;
}

/* Os templates usam min-h-[297mm] apenas para representar uma folha no
   preview. Na impressão a altura precisa ser determinada pelo conteúdo. */
.resume-print-document > div {
  min-height: 0 !important;
}

.resume-print-document::after,
.resume-print-document .resume-brand-footer {
  display: none !important;
}

/* Não alteramos grid, flex, col-span, larguras, gaps ou paddings do modelo.
   Criativo, Moderno, Clássico e Minimalista imprimem com a mesma composição
   visual exibida no preview. */
.resume-print-document section,
.resume-print-document article {
  break-inside: auto !important;
  page-break-inside: auto !important;
}

.resume-print-document .break-inside-avoid:not(.resume-print-splittable),
.resume-print-document li,
.resume-print-document img {
  break-inside: avoid-page !important;
  page-break-inside: avoid !important;
}

.resume-print-document .resume-print-splittable {
  break-inside: auto !important;
  page-break-inside: auto !important;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

.resume-print-document .resume-print-stage {
  break-inside: avoid-page !important;
  page-break-inside: avoid !important;
}

.resume-print-document .resume-print-keep-with-next,
.resume-print-document h1,
.resume-print-document h2,
.resume-print-document h3,
.resume-print-document h4 {
  break-after: avoid-page !important;
  page-break-after: avoid !important;
}

.resume-print-document p {
  orphans: 3 !important;
  widows: 3 !important;
}

#resume-print-footer {
  position: fixed;
  left: 12mm;
  right: 12mm;
  bottom: 2.4mm;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 5.5mm;
  border-top: 1px solid rgba(87, 72, 64, .12);
  color: rgba(87, 72, 64, .52);
  background: #fff;
  font-family: Arial, sans-serif;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: .02em;
  line-height: 1;
}

#resume-print-footer img {
  width: 9px;
  height: 9px;
  object-fit: contain;
  opacity: .68;
}

@media screen {
  body {
    background: #e7e5e4 !important;
  }

  .resume-print-shell {
    margin: 20px auto !important;
    box-shadow: 0 20px 60px rgba(28, 25, 23, .18);
  }
}
`;

async function waitForAssets(printWindow: Window): Promise<void> {
  const printDocument = printWindow.document;
  const images = Array.from(printDocument.images);

  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
        window.setTimeout(resolve, 2500);
      });
    }),
  );

  try {
    await printDocument.fonts?.ready;
  } catch {
    // A impressão continua mesmo se uma fonte externa demorar ou falhar.
  }
}

async function printResume(): Promise<void> {
  const resume = cloneResumeForPrint();
  if (!resume) {
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank', 'width=960,height=760');
  if (!printWindow) {
    window.print();
    return;
  }

  const styles = collectHeadStyles();

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>&#8203;</title>
${styles}
<style>${PRINT_CSS}</style>
</head>
<body></body>
</html>`);
  printWindow.document.close();

  const shell = printWindow.document.createElement('div');
  shell.className = 'resume-print-shell';
  shell.appendChild(printWindow.document.importNode(resume, true));
  printWindow.document.body.appendChild(shell);

  const footer = printWindow.document.createElement('div');
  footer.id = 'resume-print-footer';
  footer.innerHTML =
    '<img src="/brand/symbol-terracotta.png" alt="" aria-hidden="true" /><span>Criado com <strong>piranegocios.com.br</strong></span>';
  printWindow.document.body.appendChild(footer);

  await waitForAssets(printWindow);

  printWindow.addEventListener(
    'afterprint',
    () => {
      window.setTimeout(() => printWindow.close(), 50);
    },
    { once: true },
  );

  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 180);
}

function isResumePdfButton(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest('button');
  if (!button || !button.closest('#resume-builder-sidebar')) return false;
  return normalizeText(button.textContent) === 'pdf';
}

function installScreenFooterLabel(): void {
  if (document.getElementById(SCREEN_FOOTER_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = SCREEN_FOOTER_STYLE_ID;
  style.textContent = `
    .resume-brand-footer span { font-size: 0 !important; }
    .resume-brand-footer span::after {
      content: 'Criado com piranegocios.com.br';
      font-size: 8px;
      font-weight: 600;
      letter-spacing: .02em;
    }
  `;
  document.head.appendChild(style);
}

export function initResumePrint(): void {
  if (typeof document === 'undefined') return;
  installScreenFooterLabel();

  document.addEventListener(
    'click',
    (event) => {
      if (!isResumePdfButton(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void printResume();
    },
    true,
  );
}
