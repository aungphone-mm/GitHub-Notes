import { GoogleGenAI } from '@google/genai';

/**
 * How the app reaches a model. Three routes, tried in this order:
 *
 * 1. `proxyUrl` — the Cloudflare worker in `worker/`, which runs in a supported
 *    region and injects the real Gemini key server-side.
 * 2. `openrouterKey` — OpenRouter calls the model from its own servers, so it
 *    clears a Gemini geo-block too, with nothing to deploy.
 * 3. `geminiKey` — the browser talks to Google directly. Fails where Gemini is
 *    geo-blocked, which is what routes 1 and 2 exist to solve.
 *
 * The worker wins when both it and an OpenRouter key are present: deploying one
 * is deliberate, so routing around it silently would be the surprising choice.
 */
export interface AiSettings {
  proxyUrl?: string;
  proxyKey?: string;
  geminiKey?: string;
  openrouterKey?: string;
}

/**
 * Resolve the Gemini API key for direct (non-proxied) calls.
 * Priority: explicit override → GEMINI_API_KEY env var (injected by AI Studio) → empty string.
 */
function resolveApiKey(overrideKey?: string): string {
  if (overrideKey && overrideKey.trim()) return overrideKey.trim();
  // Vite exposes env vars via import.meta.env at build time.
  // Cast through unknown to satisfy strict tsconfig that lacks vite/client types.
  const meta = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return meta.GEMINI_API_KEY || meta.VITE_GEMINI_API_KEY || '';
}

function getClient(settings: AiSettings = {}): GoogleGenAI {
  const proxyUrl = settings.proxyUrl?.trim().replace(/\/+$/, '');

  if (proxyUrl) {
    const proxyKey = settings.proxyKey?.trim();
    if (!proxyKey) throw new Error('AI proxy key is not configured.');
    return new GoogleGenAI({
      // The proxy replaces this placeholder with the real key server-side.
      // The SDK refuses to build a request without some apiKey value.
      apiKey: 'via-proxy',
      httpOptions: {
        baseUrl: proxyUrl,
        headers: { 'x-proxy-key': proxyKey }
      }
    });
  }

  const key = resolveApiKey(settings.geminiKey);
  if (!key) {
    throw new Error(
      'No AI provider is configured. Set an AI proxy URL, an OpenRouter key, or a Gemini key in settings.'
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

const MODEL = 'gemini-3.6-flash';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** Free auto-routed model. OpenRouter picks an available free provider. */
const OPENROUTER_MODEL = 'openrouter/free';
/**
 * Sent as the `models` array so OpenRouter can route around a free provider
 * that is down. This matters here because the app has no model picker — without
 * fallbacks, one unavailable free provider leaves the user no way through.
 */
const OPENROUTER_FALLBACKS = [
  OPENROUTER_MODEL,
  'openai/gpt-oss-20b:free',
  'inclusionai/ling-3.0-flash:free'
];

/**
 * Parses Gemini API errors to provide user-friendly messages.
 */
function handleApiError(err: any): never {
  const msg = typeof err === 'string' ? err : (err?.message || String(err));

  if (msg.includes('User location is not supported') || msg.includes('FAILED_PRECONDITION')) {
    throw new Error(
      'Gemini is blocked in this region. Set an AI proxy URL (see worker/README.md) or an OpenRouter key in settings.'
    );
  }

  if (msg.includes('Invalid or missing proxy key')) {
    throw new Error('AI proxy rejected the request: check the proxy key in settings.');
  }

  // Try to parse raw JSON error strings from the SDK
  try {
    const match = msg.match(/({.*})/);
    if (match) {
      const parsed = JSON.parse(match[1]);
      if (parsed.error?.message) {
        if (parsed.error.message.includes('User location is not supported')) {
          throw new Error(
            'Gemini is blocked in this region. Set an AI proxy URL (see worker/README.md) or an OpenRouter key in settings.'
          );
        }
        throw new Error(parsed.error.message);
      }
    }
  } catch (e) {
    // Ignore JSON parse errors
  }

  throw new Error(msg || 'AI Request Failed.');
}

/**
 * Send one prompt to OpenRouter and return the reply text.
 *
 * Errors are thrown display-ready rather than routed through `handleApiError`,
 * whose parsing is written against the Gemini SDK's error strings.
 */
async function postOpenRouter(prompt: string, apiKey: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Both headers are required by OpenRouter for browser-originated calls.
        'HTTP-Referer': window.location.href,
        'X-Title': 'GitHub Notes'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        models: OPENROUTER_FALLBACKS,
        messages: [{ role: 'user', content: prompt }]
      })
    });
  } catch (err) {
    throw new Error(`Could not reach OpenRouter: ${(err as Error).message}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid response from OpenRouter.');
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid or unauthorized OpenRouter API key.');
    }
    throw new Error(
      data?.error?.message || data?.message || `OpenRouter request failed (${response.status}).`
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || !String(content).trim()) {
    throw new Error('OpenRouter returned an empty response.');
  }
  return String(content).trim();
}

/**
 * Run one prompt against whichever provider is configured and return the reply
 * as plain text. Every AI feature below goes through here, so the three routes
 * documented on `AiSettings` are chosen in exactly one place.
 */
async function runPrompt(prompt: string, settings: AiSettings = {}): Promise<string> {
  const openrouterKey = settings.openrouterKey?.trim();
  if (!settings.proxyUrl?.trim() && openrouterKey) {
    return postOpenRouter(prompt, openrouterKey);
  }

  const ai = getClient(settings);
  try {
    const response = await ai.models.generateContent({ model: MODEL, contents: prompt });
    return response.text?.trim() ?? '';
  } catch (err) {
    handleApiError(err);
  }
}

/**
 * Suggest up to 5 relevant tags for a note based on its title and body.
 * Returns an array of lowercase tag strings.
 */
export async function suggestTags(
  title: string,
  body: string,
  settings?: AiSettings
): Promise<string[]> {
  const prompt = `You are a note-tagging assistant. Given the following note title and content, suggest up to 5 short, relevant lowercase tags (single words or hyphenated-words, no # prefix).

Note title: ${title || '(untitled)'}

Note content:
${body.slice(0, 2000)}

Return ONLY a JSON array of strings, e.g. ["productivity","react","ideas"]. No explanation.`;

  const text = await runPrompt(prompt, settings);
  // Strip any markdown code fences the model may add
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((t): t is string => typeof t === 'string')
        .map(t => t.toLowerCase().replace(/\s+/g, '-').slice(0, 30))
        .slice(0, 5);
    }
  } catch {
    // Parse fallback: split comma-separated text
    return cleaned
      .replace(/[\[\]"']/g, '')
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5);
  }
  return [];
}

/**
 * Generate a concise, descriptive title for the given note body.
 * Returns a plain string title (no markdown, no quotes).
 */
export async function generateTitle(
  body: string,
  settings?: AiSettings
): Promise<string> {
  const prompt = `You are a note-titling assistant. Given the following note content, generate a concise, descriptive title (max 8 words, plain text, no markdown, no quotes).

Note content:
${body.slice(0, 2000)}

Return ONLY the title text on a single line.`;

  const text = await runPrompt(prompt, settings);

  return text
    .replace(/^["']|["']$/g, '')
    .slice(0, 80);
}

/**
 * Summarize a note into 2–4 bullet points of the key ideas.
 * Returns a markdown-formatted string.
 */
export async function summarizeNote(
  title: string,
  body: string,
  settings?: AiSettings
): Promise<string> {
  const prompt = `You are a concise note-summarization assistant. Summarize the following note into 2–4 bullet points capturing the most important ideas. Use plain markdown bullets (- item). Keep each bullet under 15 words.

Note title: ${title || '(untitled)'}

Note content:
${body.slice(0, 3000)}

Return ONLY the bullet list, nothing else.`;

  return runPrompt(prompt, settings);
}
