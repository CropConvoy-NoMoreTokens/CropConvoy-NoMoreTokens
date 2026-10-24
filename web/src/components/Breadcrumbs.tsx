import { CaretRight } from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router-dom';
import { shortId } from '../lib/format';

type Crumb = { label: string; to?: string };

export function Breadcrumbs() {
  const { pathname, search } = useLocation();
  if (pathname === '/') return null;

  const crumbs: Crumb[] = [{ label: 'Home', to: '/' }];
  if (pathname === '/login') {
    crumbs.push({ label: 'Sign in' });
  } else {
    const role = pathname.match(/^\/app\/(farmer|buyer|transporter)$/)?.[1];
    if (role) {
      const workspace = `${role[0].toUpperCase()}${role.slice(1)} workspace`;
      const params = new URLSearchParams(search);
      const record = role === 'farmer' ? params.get('listing') : params.get(role === 'buyer' ? 'order' : 'trip');
      const plan = role === 'farmer' && record ? params.get('plan') : null;
      crumbs.push({ label: workspace, to: record ? pathname : undefined });
      if (record) {
        const kind = role === 'farmer' ? 'Harvest' : role === 'buyer' ? 'Order' : 'Trip';
        crumbs.push({ label: `${kind} ${shortId(record)}`, to: plan ? `${pathname}?listing=${encodeURIComponent(record)}` : undefined });
      }
      if (plan) crumbs.push({ label: `Proposal ${shortId(plan)}` });
    } else {
      crumbs.push({ label: 'Page not found' });
    }
  }

  return <nav className="breadcrumb-bar section-container" aria-label="Breadcrumb">
    <ol>{crumbs.map((crumb, index) => <li key={`${crumb.label}-${index}`}>
      {index > 0 && <CaretRight size={14} aria-hidden="true" />}
      {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
    </li>)}</ol>
  </nav>;
}
