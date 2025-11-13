export const config = { runtime: 'edge' };

const WHITELISTED_DOMAINS = [
  'jsonplaceholder.typicode.com',
  'httpbin.org',
  'api.github.com',
  'scratch.mit.edu',
  'api.scratch.mit.edu',
  'shaman2016scratch.github.io',
  'dashblocks.github.io',
  'turbowarp.org',
  'mirror.turbowarp.xyz',
  'github.com',
  'telegram.org',
  'api.telegram.org',
  'penguinmod.com',
];

const TIMEOUT_MS = 25000;

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default async function handler(req) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');
  const method = (url.searchParams.get('method') || 'GET').toUpperCase();
  const headersParam = url.searchParams.get('headers');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Parameter "url" is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    new URL(targetUrl);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!ALLOWED_METHODS.includes(method)) {
    return new Response(JSON.stringify({ 
      error: `Method ${method} not allowed`,
      allowed: ALLOWED_METHODS
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const targetHost = new URL(targetUrl).host;
  if (!WHITELISTED_DOMAINS.some(domain => 
    targetHost === domain || targetHost.endsWith(`.${domain}`)
  )) {
    return new Response(JSON.stringify({
      error: 'Access denied: domain not in whitelist',
      allowedDomains: WHITELISTED_DOMAINS
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let customHeaders = {};
  if (headersParam) {
    try {
      customHeaders = JSON.parse(headersParam);
      if (typeof customHeaders !== 'object' || customHeaders === null) {
        throw new Error('Invalid headers format');
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid headers JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  const finalHeaders = new Headers();
  finalHeaders.set('User-Agent', req.headers.get('User-Agent') || 'Vercel-Proxy/1.0');
  Object.keys(customHeaders).forEach(key => {
    finalHeaders.set(key, customHeaders[key]);
  });

  const hasRequestBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  let body = null;
  if (hasRequestBody) {
    body = await req.text();
    if (body === '') body = null;
  }

  try {
    const response = await fetch(targetUrl, {
      method: method,
      headers: finalHeaders,
      body: body,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!['set-cookie', 'content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });
    if (!responseHeaders.get('content-type')) {
      responseHeaders.set('content-type', 'text/plain');
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch resource',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
