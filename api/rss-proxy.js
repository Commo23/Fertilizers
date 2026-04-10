import allowedDomains from '../shared/rss-allowed-domains.cjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getAllowedSet() {
  const arr = Array.isArray(allowedDomains) ? allowedDomains : [];
  return new Set(arr.map((d) => String(d || '').trim()).filter(Boolean));
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const feedUrl = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!feedUrl) return res.status(400).json({ error: 'Missing url parameter' });

  let parsed;
  try {
    parsed = new URL(feedUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid url parameter' });
  }

  const allowed = getAllowedSet();
  if (!allowed.has(parsed.hostname)) {
    return res.status(403).json({
      error: `Domain not allowed: ${parsed.hostname}`,
      hint: 'Add the domain to shared/rss-allowed-domains.json',
    });
  }

  const controller = new AbortController();
  const timeoutMs = feedUrl.includes('news.google.com') ? 20000 : 12000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    const data = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(data);
  } catch (error) {
    clearTimeout(timer);
    const isTimeout = error && (error.name === 'AbortError' || String(error.message || '').includes('aborted'));
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'Feed timeout' : 'Failed to fetch feed',
    });
  }
}

