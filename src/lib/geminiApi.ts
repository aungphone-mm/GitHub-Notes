import { GoogleGenAI } from '@google/genai';

/**
 * How the app reaches Gemini.
 *
 * When `proxyUrl` is set, requests go through the Cloudflare worker in
 * `worker/`, which runs in a supported region and injects the real API key.
 * That is the path to use where Gemini is geo-blocked. Otherwise the browser
 * talks to Google directly with `geminiKey`.
 */
export interface AiSettings {
  proxyUrl?: string;
  proxyKey?: string;
  geminiKey?: string;
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
  if (!key) throw new Error('Gemini API key is not configured.');
  return new GoogleGenAI({ apiKey: key });
}

const MODEL = 'gemini-3.6-flash';

/**
 * Parses Gemini API errors to provide user-friendly messages.
 */
function handleApiError(err: any): never {
  const msg = typeof err === 'string' ? err : (err?.message || String(err));

  if (msg.includes('User location is not supported') || msg.includes('FAILED_PRECONDITION')) {
    throw new Error(
      'Gemini is blocked in this region. Configure the AI proxy URL in settings to route requests through the worker.'
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
            'Gemini is blocked in this region. Configure the AI proxy URL in settings to route requests through the worker.'
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
 * Suggest up to 5 relevant tags for a note based on its title and body.
 * Returns an array of lowercase tag strings.
 */
export async function suggestTags(
  title: string,
  body: string,
  settings?: AiSettings
): Promise<string[]> {
  const ai = getClient(settings);

  const prompt = `You are a note-tagging assistant. Given the following note title and content, suggest up to 5 short, relevant lowercase tags (single words or hyphenated-words, no # prefix).

Note title: ${title || '(untitled)'}

Note content:
${body.slice(0, 2000)}

Return ONLY a JSON array of strings, e.g. ["productivity","react","ideas"]. No explanation.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt
    });
  } catch (err) {
    handleApiError(err);
  }

  const text = response.text?.trim() ?? '';
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
  const ai = getClient(settings);

  const prompt = `You are a note-titling assistant. Given the following note content, generate a concise, descriptive title (max 8 words, plain text, no markdown, no quotes).

Note content:
${body.slice(0, 2000)}

Return ONLY the title text on a single line.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt
    });
  } catch (err) {
    handleApiError(err);
  }

  return (response.text?.trim() ?? '')
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
  const ai = getClient(settings);

  const prompt = `You are a concise note-summarization assistant. Summarize the following note into 2–4 bullet points capturing the most important ideas. Use plain markdown bullets (- item). Keep each bullet under 15 words.

Note title: ${title || '(untitled)'}

Note content:
${body.slice(0, 3000)}

Return ONLY the bullet list, nothing else.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt
    });
  } catch (err) {
    handleApiError(err);
  }

  return response.text?.trim() ?? '';
}
