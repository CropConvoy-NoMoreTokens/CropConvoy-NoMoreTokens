import { Link, Navigate, useParams } from 'react-router-dom';
import { Plant, Basket, Truck, ArrowsLeftRight } from '@phosphor-icons/react';
import { useApp } from '../state/AppContext';
import type { Role, Meta } from '../api/types';
import Farmer from './workspaces/Farmer';
import Buyer from './workspaces/Buyer';
import Transporter from './workspaces/Transporter';
const content = {
  farmer: { title: 'A good day to grow.', subtitle: 'Your harvest, your requirements, your next step.', icon: Plant },
  buyer: { title: 'Fresh possibilities ahead.', subtitle: 'Tell growers what you need, and when you need it.', icon: Basket },
  transporter: { title: 'Make room for possibility.', subtitle: 'Share your journey and the space you have available.', icon: Truck },
};
export function ModeNotice({ meta }: { meta?: Meta }) {
  const { service } = useApp();
  if (service.mode === 'demo') return <div className="mode-notice"><span className="badge">Interactive demo</span><p>Sample data and simulated outcomes. Records stay in this tab for the session; no real shipment is created.</p></div>;
  return <div className={`mode-notice ${meta?.mode === 'live' ? '' : 'mode-pending'}`}><span className="badge">{meta?.mode === 'deterministic_fallback' ? 'Fallback mode' : meta?.mode === 'stub' ? 'Backend preview' : 'API mode'}</span><p>{meta?.mode === 'stub' ? 'This backend response is a stub. Unfinished matching is not a completed search.' : meta?.mode === 'deterministic_fallback' ? 'This result uses deterministic fallback. Review the provided constraints before deciding.' : 'Results come from the configured API. Buyer and transporter confirmations are required.'}</p></div>;
}
export default function Workspace() {
  const { role } = useParams();
  const { identity } = useApp();
  if (!['farmer', 'buyer', 'transporter'].includes(role || '')) return <Navigate to="/login" replace />;
  if (!identity || identity.role !== role) return <Navigate to={`/login?role=${role}`} replace />;
  const view = content[role as Role];
  const Icon = view.icon;
  return <div className="workspace section-container"><div className="workspace-header"><div><p className="workspace-label"><Icon />{role} workspace</p><h1>{view.title}</h1><p className="muted">{view.subtitle}</p></div><Link className="button button-secondary button-small" to="/login">Switch demo role<ArrowsLeftRight /></Link></div><ModeNotice />{role === 'farmer' ? <Farmer /> : role === 'buyer' ? <Buyer /> : <Transporter />}</div>;
}
