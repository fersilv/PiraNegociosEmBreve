const tokenFromPath = (pathname: string) => {
  const match = pathname.match(/^\/convites\/vaga\/([A-Za-z0-9_-]{40,100})\/?$/);
  return match?.[1] || null;
};

export function getInviteTokenFromLocation(): string | null {
  const direct = tokenFromPath(window.location.pathname);
  if (direct) return direct;
  const returnTo = new URLSearchParams(window.location.search).get('returnTo');
  if (!returnTo) return null;
  try {
    return tokenFromPath(new URL(returnTo, window.location.origin).pathname);
  } catch {
    return null;
  }
}
