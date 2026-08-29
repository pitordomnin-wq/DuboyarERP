export const PAGE_KEYS = [
  'tasks',
  'mail',
  'sales',
  'warehouse',
  'production',
  'products',
  'purchases',
  'counterparties',
  'admin',
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export function sanitizePages(pages?: string[]) {
  const selected = new Set(pages ?? []);
  return PAGE_KEYS.filter((page) => selected.has(page));
}

export function pagesIncludeAdmin(pages: string[]) {
  return pages.includes('admin');
}
