import { Component, lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { MotionConfig, LazyMotion, domAnimation } from 'motion/react';
import { IconContext } from '@phosphor-icons/react';
import { AppProvider } from './state/AppContext';
import { Layout } from './components/Layout';
import { Skeleton } from './components/ui';
import Landing from './pages/Landing';
const Login = lazy(() => import('./pages/Login'));
const Workspace = lazy(() => import('./pages/Workspace'));
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="recovery-page"><h1>Let’s get you growing again.</h1><p>This screen could not load. Your saved demo records remain in this tab.</p><button className="button" onClick={() => window.location.reload()}>Reload page</button></main> : this.props.children; }
}
export function AppRoutes() {
  return <MotionConfig reducedMotion="user"><LazyMotion features={domAnimation} strict><IconContext.Provider value={{ size: 20, weight: 'regular' }}><Routes><Route element={<Layout />}><Route index element={<Landing />} /><Route path="login" element={<Suspense fallback={<div className="section-container page-loading"><Skeleton label="Loading demo access" /></div>}><Login /></Suspense>} /><Route path="app/:role" element={<Suspense fallback={<div className="section-container page-loading"><Skeleton label="Loading workspace" /></div>}><Workspace /></Suspense>} /><Route path="*" element={<section className="section-container not-found"><h1>This path needs a new direction.</h1><p>The page you are looking for is not here.</p><Link className="button" to="/">Back to home</Link></section>} /></Route></Routes></IconContext.Provider></LazyMotion></MotionConfig>;
}
export default function App() { return <ErrorBoundary><AppProvider><HashRouter><AppRoutes /></HashRouter></AppProvider></ErrorBoundary>; }
