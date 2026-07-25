/**
 * Render an SVG signature string as a safe <img> data URI.
 *
 * Signatures produced by SignaturePad are simple `<svg><path/></svg>` markup.
 * Rendering them via `dangerouslySetInnerHTML` (even with DOMPurify) keeps the
 * markup inline in the DOM, which can allow risky SVG constructs. Encoding the
 * SVG as a base64 data URI and rendering via `<img>` isolates it as an image
 * resource: scripts inside cannot execute in an <img> context.
 *
 * If the input is empty or not an SVG, returns null so callers can render a
 * fallback.
 */
export function signatureToDataUri(svg: string | null | undefined): string | null {
  if (!svg) return null;
  const trimmed = String(svg).trim();
  if (!trimmed.toLowerCase().startsWith('<svg')) return null;
  try {
    // btoa handles ASCII; SignaturePad output is ASCII-only. Fall back to
    // encodeURIComponent for any wider characters just in case.
    const b64 =
      typeof btoa === 'function'
        ? btoa(unescape(encodeURIComponent(trimmed)))
        : '';
    if (!b64) return null;
    return `data:image/svg+xml;base64,${b64}`;
  } catch {
    return null;
  }
}
