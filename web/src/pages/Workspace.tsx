import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Plant, Basket, Truck, ArrowsLeftRight } from '@phosphor-icons/react';
import { useApp } from '../state/AppContext';
import { Skeleton } from '../components/ui';
import type { Role } from '../api/types';
import Farmer from './workspaces/Farmer';
import Buyer from './workspaces/Buyer';
import Transporter from './workspaces/Transporter';
const content = {
  farmer: { title: 'A good day to grow.', subtitle: 'Your harvest, your requirements, your next step.', icon: Plant },
  buyer: { title: 'Fresh possibilities ahead.', subtitle: 'Tell growers what you need, and when you need it.', icon: Basket },
  transporter: { title: 'Make room for possibility.', subtitle: 'Share your journey and the space you have available.', icon: Truck },
};
export default function Workspace() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { identity, authReady, service, logout } = useApp();
  if (!['farmer', 'buyer', 'transporter'].includes(role || '')) return <Navigate to="/login" replace />;
  if (!authReady) return <div className="section-container page-loading"><Skeleton label="Checking your session" /></div>;
  if (!identity || identity.role !== role) return <Navigate to={`/login?role=${role}`} replace />;
  const view = content[role as Role];
  const Icon = view.icon;
  return <div className="workspace section-container"><div className="workspace-header"><div><p className="workspace-label"><Icon />{role} workspace</p><h1>{view.title}</h1><p className="muted">{view.subtitle}</p></div>{service.mode === 'api' ? <button className="button button-secondary button-small" onClick={() => { void logout().then(() => navigate('/login')); }}>Switch account<ArrowsLeftRight /></button> : <Link className="button button-secondary button-small" to="/login">Switch demo role<ArrowsLeftRight /></Link>}</div>{role === 'farmer' ? <Farmer /> : role === 'buyer' ? <Buyer /> : <Transporter />}</div>;
}
