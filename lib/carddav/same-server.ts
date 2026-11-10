/**
 * Whether two CardDAV server URLs point at the same address. Case and trailing
 * slashes are ignored. A saved password may only travel to a server for which
 * this is true.
 */
export function sameServer(a: string, b: string): boolean {
  const normalize = (url: string) => url.trim().replace(/\/+$/, '').toLowerCase();
  return normalize(a) === normalize(b);
}
