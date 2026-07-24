/**
 * UTF-8 safe base64 encoding and decoding.
 * Supports Burmese script, emojis, and non-Latin1 unicode characters.
 * Uses 0x8000 (32768) chunk size to prevent argument stack overflow on large notes.
 */

export function b64encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export function b64decode(b64: string): string {
  // Strip whitespace and newlines inserted by API responses
  const cleanB64 = b64.replace(/\s/g, '');
  const binary = atob(cleanB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}
