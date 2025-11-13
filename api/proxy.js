export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Parameter "url" is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try { new URL(targetUrl); }
  catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const allowedDomains = ['jsonplaceholder.typicode.com', 'httpbin.org'];
  if (!allowedDomains.some(domain => targetUrl.includes(domain))) {
    return new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'User-Agent': req.headers.get('User-Agent') || 'Vercel-Proxy' },
      signal: AbortSignal.timeout(25000)
    });

    const headers = new Headers();
    response.headers.forEach((value, key) => {
      if (!['set-cookie', 'content-encoding'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });
    if (!headers.get('content-type')) headers.set('content-type', 'text/plain');

    return new Response(response.body, { status: response.status, headers });
  }
  catch (error) {
    return new Response(JSON.stringify({ error: 'Fetch failed', details: error.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
