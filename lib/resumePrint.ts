const SCREEN_FOOTER_STYLE_ID = 'resume-screen-footer-label';

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function findSectionByHeading(root: Element, labels: string[]): HTMLElement | null {
  const wanted = labels.map(normalizeText);
  const sections = Array.from(root.querySelectorAll<HTMLElement>('section'));
  return sections.find((section) => {
    const heading = section.querySelector<HTMLElement>('h1,h2,h3,h4');
    return heading ? wanted.includes(normalizeText(heading.textContent)) : false;
  }) || null;
}

function findCreativeGrid(root: HTMLElement): HTMLElement | null {
  return Array.from(root.querySelectorAll<HTMLElement>('div')).find((element) =>
    element.classList.contains('grid') &&
    element.classList.contains('grid-cols-12') &&
    element.classList.contains('gap-8') &&
    element.classList.contains('p-12') &&
    element.children.length >= 2,
  ) || null;
}

function findModernRow(root: HTMLElement): HTMLElement | null {
  return Array.from(root.querySelectorAll<HTMLElement>('div')).find((element) => {
    if (!element.classList.contains('flex') || !element.classList.contains('flex-row')) return false;
    const children = Array.from(element.children);
    return children.some((child) => child.tagName === 'ASIDE') && children.some((child) => child.tagName === 'MAIN');
  }) || null;
}

function createTopGrid(documentRef: Document, template: 'creative' | 'modern'): {
  wrapper: HTMLDivElement;
  main: HTMLDivElement;
  side: HTMLDivElement;
} {
  const wrapper = documentRef.createElement('div');
  wrapper.className = `resume-print-top-grid resume-print-top-grid--${template}`;

  const main = documentRef.createElement('div');
  main.className = 'resume-print-top-main';

  const side = documentRef.createElement('div');
  side.className = 'resume-print-top-side';

  wrapper.append(main, side);
  return { wrapper, main, side };
}

function transformCreative(root: HTMLElement): boolean {
  const grid = findCreativeGrid(root);
  if (!grid) return false;

  const left = grid.children[0] as HTMLElement | undefined;
  const right = grid.children[1] as HTMLElement | undefined;
  if (!left || !right) return false;

  root.dataset.printTemplate = 'creative';
  const { wrapper, main, side } = createTopGrid(root.ownerDocument, 'creative');

  const bio = findSectionByHeading(left, ['Sobre Mim']);
  if (bio) main.appendChild(bio);

  while (right.firstChild) side.appendChild(right.firstChild);
  right.remove();

  if (!main.childElementCount) main.remove();
  if (!side.childElementCount) side.remove();

  if (wrapper.childElementCount) grid.parentElement?.insertBefore(wrapper, grid);

  grid.classList.add('resume-print-flow-container');
  left.classList.add('resume-print-main-flow');
  return true;
}

function transformModern(root: HTMLElement): boolean {
  const row = findModernRow(root);
  if (!row) return false;

  const aside = Array.from(row.children).find((child) => child.tagName === 'ASIDE') as HTMLElement | undefined;
  const mainFlow = Array.from(row.children).find((child) => child.tagName === 'MAIN') as HTMLElement | undefined;
  if (!aside || !mainFlow) return false;

  root.dataset.printTemplate = 'modern';
  const { wrapper, main, side } = createTopGrid(root.ownerDocument, 'modern');

  const bio = findSectionByHeading(mainFlow, ['Sobre Mim']);
  if (bio) main.appendChild(bio);

  while (aside.firstChild) side.appendChild(aside.firstChild);
  aside.remove();

  if (!main.childElementCount) main.remove();
  if (!side.childElementCount) side.remove();

  if (wrapper.childElementCount) row.parentElement?.insertBefore(wrapper, row);

  row.classList.add('resume-print-flow-container');
  mainFlow.classList.add('resume-print-main-flow');
  return true;
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
  const source = document.querySelector<HTMLElement>('#resume-preview-area .resume-a4-document');
  if (!source) return null;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('style').forEach((style) => style.remove());
  clone.querySelector('.resume-brand-footer')?.remove();
  clone.classList.add('resume-print-document');

  if (!transformCreative(clone)) transformModern(clone);
  markPrintBreakpoints(clone);
  return clone;
}

function collectHeadStyles(): string {
  return Array.from(document.head.querySelectorAll<HTMLElement>('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n');
}

const PRINT_CSS = `
@page {
  size: A4 portrait;
  margin: 9mm 10mm 16mm;
}

html,
body {
  margin: 0 !important;
  padding: 0 !important;
  background: #fff !important;
  color: #292524;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

body {
  width: auto !important;
  min-width: 0 !important;
  overflow: visible !important;
}

.resume-print-shell {
  width: 190mm;
  margin: 0 auto;
}

.resume-print-document {
  position: static !important;
  width: 190mm !important;
  min-width: 190mm !important;
  max-width: 190mm !important;
  min-height: 0 !important;
  height: auto !important;
  margin: 0 auto !important;
  padding: 0 !important;
  border: 0 !important;
  box-shadow: none !important;
  overflow: visible !important;
  background: #fff !important;
  box-sizing: border-box !important;
}

.resume-print-document::after,
.resume-print-document .resume-brand-footer {
  display: none !important;
}

.resume-print-document > div {
  min-height: 0 !important;
}

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

.resume-print-top-grid {
  display: grid !important;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, .9fr) !important;
  gap: 8mm !important;
  align-items: start !important;
  padding: 8mm 12mm 6mm !important;
  break-inside: avoid-page !important;
  page-break-inside: avoid !important;
  box-sizing: border-box !important;
}

.resume-print-top-grid > :only-child {
  grid-column: 1 / -1;
}

.resume-print-top-main,
.resume-print-top-side {
  min-width: 0 !important;
}

.resume-print-top-main > section,
.resume-print-top-side > section {
  margin-top: 0 !important;
}

.resume-print-top-grid--modern .resume-print-top-side {
  border-radius: 16px;
  background: #fafaf9;
  border: 1px solid #e7e5e4;
  padding: 5mm;
}

.resume-print-document [data-print-template="creative"] {
  width: 100%;
}

.resume-print-document .resume-print-flow-container {
  display: block !important;
  width: 100% !important;
  max-width: none !important;
  padding: 0 12mm 10mm !important;
  box-sizing: border-box !important;
}

.resume-print-document .resume-print-main-flow {
  display: block !important;
  width: 100% !important;
  max-width: none !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  border-right: 0 !important;
  box-sizing: border-box !important;
}

.resume-print-document[data-print-template="modern"] .resume-print-main-flow {
  padding-top: 2mm !important;
}

.resume-print-document[data-print-template="creative"] .resume-print-main-flow {
  padding-top: 0 !important;
}

.resume-print-document[data-print-template="creative"] .resume-print-flow-container,
.resume-print-document[data-print-template="modern"] .resume-print-flow-container {
  gap: 0 !important;
}

.resume-print-document[data-print-template="creative"] .resume-print-main-flow > section,
.resume-print-document[data-print-template="modern"] .resume-print-main-flow > section {
  width: 100% !important;
  max-width: none !important;
}

.resume-print-document[data-print-template="creative"] .resume-print-splittable,
.resume-print-document[data-print-template="modern"] .resume-print-splittable {
  width: 100% !important;
  max-width: none !important;
}

#resume-print-footer {
  position: fixed;
  left: 10mm;
  right: 10mm;
  bottom: 3.2mm;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 6mm;
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
    margin: 20px auto;
    box-shadow: 0 20px 60px rgba(28, 25, 23, .18);
  }
}
`;

async function waitForAssets(printWindow: Window): Promise<void> {
  const printDocument = printWindow.document;
  const images = Array.from(printDocument.images);
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
      window.setTimeout(resolve, 2500);
    });
  }));

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
  const shell = printWindow.document.createElement('div');
  shell.className = 'resume-print-shell';
  shell.appendChild(printWindow.document.importNode(resume, true));

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

  printWindow.document.body.appendChild(shell);

  const footer = printWindow.document.createElement('div');
  footer.id = 'resume-print-footer';
  footer.innerHTML = '<img src="/brand/symbol-terracotta.png" alt="" aria-hidden="true" /><span>Criado com <strong>piranegocios.com.br</strong></span>';
  printWindow.document.body.appendChild(footer);

  await waitForAssets(printWindow);

  printWindow.addEventListener('afterprint', () => {
    window.setTimeout(() => printWindow.close(), 50);
  }, { once: true });

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

  document.addEventListener('click', (event) => {
    if (!isResumePdfButton(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void printResume();
  }, true);
}
