const key = 'cropconvoy.apiToken';
let memoryToken: string | null = null;
const expiredListeners = new Set<() => void>();

export function getApiToken(): string | null {
  if (memoryToken) return memoryToken;
  try { return sessionStorage.getItem(key); } catch { return null; }
}

export function setApiToken(token: string): void {
  memoryToken = token;
  try { sessionStorage.setItem(key, token); } catch { /* Keep the token for this page only. */ }
}

export function clearApiToken(): void {
  memoryToken = null;
  try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}

export function expireApiToken(token: string): void {
  if (getApiToken() !== token) return;
  clearApiToken();
  expiredListeners.forEach(listener => listener());
}

export function onApiTokenExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => { expiredListeners.delete(listener); };
}
