/** Routes reachable without a session. Everything else requires login (brief §2: no public routes except login). */
const PUBLIC_PATHS = new Set(["/login"]);

/** Paths that authenticate themselves (e.g. bearer tokens) and must not be redirected to /login. */
const SELF_AUTHENTICATED_PREFIXES: readonly string[] = ["/api/worker"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export function isSelfAuthenticatedPath(pathname: string): boolean {
  return SELF_AUTHENTICATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Only allow same-site relative redirects after login, never `//host` or absolute URLs. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next === "/login") return "/";
  return next;
}
