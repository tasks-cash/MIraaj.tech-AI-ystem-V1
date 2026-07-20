const UNSAFE_FILENAME_PATTERN = /[^a-zA-Z0-9._-]+/g;

export function sanitizeFilename(originalFilename: string): string {
  const trimmed = originalFilename.trim().slice(0, 200);
  const baseName = trimmed.split(/[/\\]/).pop() ?? "upload";
  const sanitized = baseName
    .replace(UNSAFE_FILENAME_PATTERN, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized.length > 0 ? sanitized : "upload";
}

export function isAllowedDeclaredMime(mimeType: string): boolean {
  return (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/webp" ||
    mimeType === "application/pdf"
  );
}
