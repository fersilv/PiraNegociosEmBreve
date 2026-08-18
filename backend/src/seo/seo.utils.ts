const RESERVED_COMPANY_SLUGS = new Set([
  'api',
  'admin',
  'dashboard',
  'vagas',
  'login',
  'termos',
  'uploads',
  'assets',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
  'sw.js',
]);

/** Creates a stable, URL-safe identifier without relying on a client supplied value. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

export function validateCompanySlug(value: string): string {
  const slug = slugify(value);
  if (slug.length < 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      'Escolha um endereço público entre 3 e 72 caracteres, usando letras, números e hífens.',
    );
  }
  if (RESERVED_COMPANY_SLUGS.has(slug)) {
    throw new Error('Este endereço é reservado pelo sistema. Escolha outro.');
  }
  return slug;
}

export function isReservedCompanySlug(slug: string): boolean {
  return RESERVED_COMPANY_SLUGS.has(slug);
}
