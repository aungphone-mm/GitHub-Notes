import { GoogleGenAI } from '@google/genai';

/**
 * Resolve the Gemini API key.
 * Priority: explicit override → GEMINI_API_KEY env var (injected by AI Studio) → empty string.
 */
function resolveApiKey(overrideKey?: string): string {
  if (overrideKey && overrideKey.trim()) return overrideKey.trim();
  // Vite exposes env vars via import.meta.env at build time.
  // Cast through unknown to satisfy strict tsconfig that lacks vite/client types.
  const meta = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return meta.GEMINI_API_KEY || meta.VITE_GEMINI_API_KEY || '';
}

function getClient(apiKey: string): GoogleGenAI {
  if (!apiKey) throw new Error('Gemini API key is not configured.');
  return new GoogleGenAI({ apiKey });
}

const MODEL = 'gemini-3.6-flash';

/**
 * Suggest up to 5 relevant tags for a note based on its title and body.
 * Returns an array of lowercase tag strings.
 */
export async function suggestTags(
  title: string,
  body: string,
  apiKey?: string
): Promise<string[]> {
  const key = resolveApiKey(apiKey);
  const ai = getClient(key);

  const prompt = `You are a note-tagging assistant. Given the following note title and content, suggest up to 5 short, relevant lowercase tags (single words or hyphenated-words, no # prefix).

Note title: ${title || '(untitled)'}

Note content:
${body.slice(0, 2000)}

Return ONLY a JSON array of strings, e.g. ["productivity","react","ideas"]. No explanation.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt
  });

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
  apiKey?: string
): Promise<string> {
  const key = resolveApiKey(apiKey);
  const ai = getClient(key);

  const prompt = `You are a note-titling assistant. Given the following note content, generate a concise, descriptive title (max 8 words, plain text, no markdown, no quotes).

Note content:
${body.slice(0, 2000)}

Return ONLY the title text on a single line.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt
  });

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
  apiKey?: string
): Promise<string> {
  const key = resolveApiKey(apiKey);
  const ai = getClient(key);

  const prompt = `You are a concise note-summarization assistant. Summarize the following note into 2–4 bullet points capturing the most important ideas. Use plain markdown bullets (- item). Keep each bullet under 15 words.

Note title: ${title || '(untitled)'}

Note content:
${body.slice(0, 3000)}

Return ONLY the bullet list, nothing else.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt
  });

  return response.text?.trim() ?? '';
}
