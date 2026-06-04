/**
 * Normalizes URLs for iframe embeds and external links.
 * SEQTA often returns bare hostnames (e.g. "www.mathletics.com") without a protocol.
 */
export function normalizeEmbedUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;

  let value = raw.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).href;
    } catch {
      return null;
    }
  }

  if (value.startsWith('//')) {
    try {
      return new URL(`https:${value}`).href;
    } catch {
      return null;
    }
  }

  // App-relative paths cannot be embedded in a cross-origin iframe from the DesQTA origin.
  if (value.startsWith('/')) {
    return null;
  }

  try {
    return new URL(`https://${value.replace(/^\/+/, '')}`).href;
  } catch {
    return null;
  }
}
