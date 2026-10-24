import { useState } from 'react';
import { apiRequest } from './api/client';
type Role = 'Farmer' | 'Buyer' | 'Transporter';
const next: Record<Role, string> = {
  Farmer: 'Harvest text → review fields → pickup pin → publish → find proposal → accept or reject.',
  Buyer: 'Crop, demand, offered price, delivery pin, deadline and partial fulfillment.',
  Transporter: 'Start and end pins, departure, capacity, fare rules and detour limits.',
};
export default function App() {
  const [role, setRole] = useState<Role>('Farmer');
  const [status, setStatus] = useState('Not checked');
  const [busy, setBusy] = useState(false);
  async function checkApi() {
    setBusy(true);
    try {
      const result = await apiRequest<{ status: string }>('/health');
      setStatus(`API ${result.data.status} · ${result.meta.mode} mode · ${result.meta.persistence} storage`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'API unavailable'); }
    finally { setBusy(false); }
  }
  return <main>
    <p className="eyebrow">CROPCONVOY / TEAM STARTER</p>
    <h1>From harvest to a better route.</h1>
    <p>Project foundation for the six-hour prototype. The product screens are ready for P1 to build.</p>
    <nav aria-label="Demo roles">{(['Farmer', 'Buyer', 'Transporter'] as const).map(item =>
      <button key={item} aria-pressed={role === item} onClick={() => setRole(item)}>{item}</button>)}</nav>
    <section aria-labelledby="role-heading"><h2 id="role-heading">{role}</h2><p>{next[role]}</p>
      <p className="notice">Starter only: extraction, road routing and real proposal generation are pending. Temporary data disappears when the API restarts.</p></section>
    <section aria-labelledby="connection-heading"><h2 id="connection-heading">API connection</h2>
      <button disabled={busy} onClick={checkApi}>{busy ? 'Checking…' : 'Check connection'}</button>
      <p role="status">{status}</p></section>
  </main>;
}
