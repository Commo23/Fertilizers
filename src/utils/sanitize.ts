export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Allow only http(s) URLs for href/src. */
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url, 'https://example.com');
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.href;
    }
  } catch {
    /* ignore */
  }
  return '#';
}
