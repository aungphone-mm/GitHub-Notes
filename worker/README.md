# Gemini proxy worker

A small Cloudflare Worker that forwards the app's Gemini requests to Google from
a supported region. Deploy this if the AI features fail with:

> Gemini is blocked in this region.

It also keeps your Gemini API key out of the browser — the key lives as a Worker
secret, and the app authenticates with a separate shared secret instead.

```
browser ──x-proxy-key──> worker ──x-goog-api-key──> generativelanguage.googleapis.com
```

## Deploy

You need a free Cloudflare account and a Gemini API key from
<https://aistudio.google.com/apikey>.

```bash
cd worker
npm install
npx wrangler login
```

Set the origins allowed to call the proxy in `wrangler.toml` (`ALLOWED_ORIGINS`).
It currently allows the GitHub Pages site and `http://localhost:3000` for local
dev — anything else gets a 403, so the proxy isn't usable by other sites.

Then set the two secrets and deploy:

```bash
npx wrangler secret put GEMINI_API_KEY   # paste your AIza… key
npx wrangler secret put PROXY_KEY        # any long random string you invent
npx wrangler deploy
```

Generate a decent `PROXY_KEY` with:

```bash
openssl rand -hex 32
```

`wrangler deploy` prints the worker URL, e.g.
`https://gemini-proxy.your-subdomain.workers.dev`.

## Point the app at it

In the app sidebar:

- **AI PROXY URL** → the worker URL from `wrangler deploy` (no trailing slash)
- **AI PROXY KEY** → the same `PROXY_KEY` you set above
- **GEMINI KEY** → leave blank; it's only used when no proxy is configured

## Verify

```bash
curl -i https://gemini-proxy.your-subdomain.workers.dev/v1beta/models/gemini-3.6-flash:generateContent \
  -H "content-type: application/json" \
  -H "x-proxy-key: YOUR_PROXY_KEY" \
  -d '{"contents":[{"parts":[{"text":"say hi"}]}]}'
```

A `200` with a `candidates` array means it works. `401` means the proxy key
doesn't match; `403` means your origin isn't in `ALLOWED_ORIGINS`.

## Notes

- Cloudflare's free plan covers 100k requests/day, far more than this app needs.
- Google's own free-tier rate limits still apply — the proxy changes *where* the
  request comes from, not your quota.
- The worker forwards `/v1beta/*` and `/v1/*` unchanged, so it keeps working if
  the app later switches models or adds streaming.
