import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode, type Context as ReactContext } from 'react';
import type { CropConvoyService, Role } from '../api/types';
import { createService } from '../api/service';
export type SearchRecord = { title: string; description: string; href: string };
type Identity = { role: Role; username: string };
type Preferences = 'essential' | 'preferences' | null;
const read = (storage: Storage, key: string) => { try { return storage.getItem(key); } catch { return null; } };
const write = (storage: Storage, key: string, value: string | null) => { try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch { /* Settings stay in memory when storage is unavailable. */ } };
function initialIdentity(): Identity | null { try { const value = JSON.parse(read(sessionStorage, 'cropconvoy.identity') || 'null'); return ['farmer', 'buyer', 'transporter'].includes(value?.role) && typeof value?.username === 'string' ? value : null; } catch { return null; } }
type Context = {
  service: CropConvoyService; identity: Identity | null; login(identity: Identity): void; logout(): void;
  theme: 'light' | 'dark'; toggleTheme(): void; preferences: Preferences; choosePreferences(value: Exclude<Preferences, null>): void;
  privacyOpen: boolean; setPrivacyOpen(open: boolean): void; message: string; notify(message: string): void;
  records: SearchRecord[]; remember(record: SearchRecord): void;
};
// Preserve context identity across development hot updates of this mixed provider/hook module.
const AppContext: ReactContext<Context | null> = import.meta.hot?.data.context ?? createContext<Context | null>(null);
if (import.meta.hot) import.meta.hot.data.context = AppContext;
export function AppProvider({ children, service: injected }: { children: ReactNode; service?: CropConvoyService }) {
  const service = useMemo(() => injected ?? createService(), [injected]);
  const [identity, setIdentity] = useState(initialIdentity);
  const [preferences, setPreferences] = useState<Preferences>(() => { const v = read(localStorage, 'cropconvoy.preferences'); return v === 'essential' || v === 'preferences' ? v : null; });
  const [privacyOpen, setPrivacyOpen] = useState(!preferences);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = preferences === 'preferences' ? read(localStorage, 'cropconvoy.theme') : null;
    return saved === 'light' || saved === 'dark' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [manualTheme, setManualTheme] = useState(false);
  const [message, setMessage] = useState('');
  const [records, setRecords] = useState<SearchRecord[]>([]);
  const notify = useCallback((text: string) => setMessage(text), []);
  const remember = useCallback((record: SearchRecord) => setRecords(previous => [...previous.filter(item => item.href !== record.href), record]), []);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(timer); }, [message]);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; if (preferences === 'preferences') write(localStorage, 'cropconvoy.theme', theme); }, [theme, preferences]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const change = (event: MediaQueryListEvent) => { if (!manualTheme && preferences !== 'preferences') setTheme(event.matches ? 'dark' : 'light'); };
    media.addEventListener('change', change); return () => media.removeEventListener('change', change);
  }, [manualTheme, preferences]);
  const login = (value: Identity) => { setIdentity(value); write(sessionStorage, 'cropconvoy.identity', JSON.stringify(value)); };
  const logout = () => { setIdentity(null); write(sessionStorage, 'cropconvoy.identity', null); notify('You have signed out of the demo.'); };
  const choosePreferences = (value: Exclude<Preferences, null>) => { setPreferences(value); write(localStorage, 'cropconvoy.preferences', value); if (value === 'essential') write(localStorage, 'cropconvoy.theme', null); setPrivacyOpen(false); notify(value === 'essential' ? 'Essential storage only. Your theme will not be saved between visits.' : 'Your display preferences can be saved on this device.'); };
  return <AppContext.Provider value={{ service, identity, login, logout, theme, toggleTheme: () => { setManualTheme(true); setTheme(value => value === 'dark' ? 'light' : 'dark'); }, preferences, choosePreferences, privacyOpen, setPrivacyOpen, message, notify, records, remember }}>{children}</AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error('AppProvider is required'); return context; }
