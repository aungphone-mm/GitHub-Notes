/**
 * Gemini proxy worker.
 *
 * Transparently forwards Generative Language API requests from the browser to
 * Google, running from a Cloudflare edge location in a supported region. This
 * exists so the app works where the Gemini API is geo-blocked and the browser
 * would otherwise get "User location is not supported".
 *
 * It also keeps the Gemini key server-side: the browser never holds it. The
 * client authenticates with a separate shared secret (PROXY_KEY) so the worker
 * is not an open relay burning your quota.
 */

const UPSTREAM = 'https://generativelanguage.googleapis.com';

/** Headers the SDK sends that must survive the browser preflight. */
const ALLOWED_HEADERS = [
  'content-type',
  'x-goog-api-key',
  'x-goog-api-client',
  'x-proxy-key'
].join(',');

export interface Env {
  /** The real Gemini API key. Set with: wrangler secret put GEMINI_API_KEY */
  GEMINI_API_KEY: string;
  /** Shared secret the client must present. Set with: wrangler secret put PROXY_KEY */
  PROXY_KEY: string;
  /** Comma-separated origins allowed to call this worker. */
  ALLOWED_ORIGINS: string;
}

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
}

/**
 * Build CORS headers for a request origin, or null if the origin is not allowed.
 * Returning null (rather than a wildcard) keeps other sites from using the proxy.
 */
function corsHeaders(request: Request, env: Env): Headers | null {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env);

  // No Origin header means a non-browser caller (curl, health check). Allow it
  // through without CORS headers; PROXY_KEY is still enforced below.
  if (!origin) return new Headers();

  if (!allowed.includes(origin) && !allowed.includes('*')) return null;

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return headers;
}

function json(body: unknown, status: number, cors: Headers): Response {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (!cors) {
      return new Response('Origin not allowed', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!env.GEMINI_API_KEY) {
      return json({ error: { message: 'Proxy is missing GEMINI_API_KEY.' } }, 500, cors);
    }

    // Reject anyone who does not know the shared secret.
    if (!env.PROXY_KEY || request.headers.get('x-proxy-key') !== env.PROXY_KEY) {
      return json({ error: { message: 'Invalid or missing proxy key.' } }, 401, cors);
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/v1beta/') && !url.pathname.startsWith('/v1/')) {
      return json({ error: { message: `Unsupported path: ${url.pathname}` } }, 404, cors);
    }

    // Rebuild the request against Google, swapping in the real key.
    const upstreamUrl = new URL(UPSTREAM);
    upstreamUrl.pathname = url.pathname;
    upstreamUrl.search = url.search;

    const upstreamHeaders = new Headers();
    const contentType = request.headers.get('content-type');
    if (contentType) upstreamHeaders.set('content-type', contentType);
    const apiClient = request.headers.get('x-goog-api-client');
    if (apiClient) upstreamHeaders.set('x-goog-api-client', apiClient);
    upstreamHeaders.set('x-goog-api-key', env.GEMINI_API_KEY);

    // Buffer rather than stream the body: prompts are a few KB and none of the
    // app's calls stream, so this sidesteps the duplex/half-stream edge cases.
    const body = request.method === 'GET' ? undefined : await request.arrayBuffer();

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl.toString(), {
        method: request.method,
        headers: upstreamHeaders,
        body
      });
    } catch (err) {
      return json(
        { error: { message: `Proxy could not reach Gemini: ${(err as Error).message}` } },
        502,
        cors
      );
    }

    // Pass the upstream response through untouched apart from CORS, so the SDK
    // sees exactly what it would have seen talking to Google directly.
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    for (const [key, value] of cors) responseHeaders.set(key, value);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  }
};
