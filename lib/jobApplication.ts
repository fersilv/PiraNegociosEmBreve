export function safeApplicationUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function applicationUrlLabel(value?: string | null): string {
  const label = String(value || "").trim();
  return label || "Candidatar-se no site da empresa";
}
