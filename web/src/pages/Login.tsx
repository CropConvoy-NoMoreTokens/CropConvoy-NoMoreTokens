import { useState, useRef, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeSlash, Plant, ShieldCheck, CheckCircle } from '@phosphor-icons/react';
import { useApp } from '../state/AppContext';
import { demoAccounts } from '../api/demo';
import { ApiError } from '../api/client';
import { Field, ErrorNotice, ErrorSummary, CopyButton } from '../components/ui';

export default function Login() {
  const { login, notify, service, authReady } = useApp();
  const [params] = useSearchParams();
  const initial = demoAccounts.find(a => a.role === params.get('role'));
  const [username, setUsername] = useState(initial?.username || '');
  const [password, setPassword] = useState(initial?.password || '');
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const navigate = useNavigate();
  const isApi = service.mode === 'api';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (locked.current || !authReady) return;
    const missing = { ...(!username.trim() ? { username: 'Enter a demo username.' } : {}),
      ...(!password ? { password: 'Enter the sample password.' } : {}) };
    if (Object.keys(missing).length) { setErrors(missing); return; }
    locked.current = true; setBusy(true); setErrors({}); setRequestError(undefined);
    try {
      const account = await login(username, password);
      notify(isApi ? `Signed in as ${account.role}.` : `Welcome to the ${account.role} demo.`);
      navigate(`/app/${account.role}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setErrors({ password: 'Those demo credentials do not match.' });
      else if (error instanceof Error && !isApi) setErrors({ password: error.message });
      else setRequestError(error);
    } finally { locked.current = false; setBusy(false); }
  }

  return <section className="login-page section-container">
    <div className="login-visual"><img src="/images/farmer-800.webp" alt="Farmer gathering tomatoes in a Sri Lankan vegetable field" width="800" height="1000" /><div className="login-visual-copy"><Plant size={40} /><h1>Your next<br />chapter grows here.</h1><p>A place for farmers, buyers and the journeys between them.</p></div></div>
    <div className="login-form-panel"><span className="badge"><ShieldCheck />Demo access</span><h2>Welcome to<br />CropConvoy.</h2><p className="muted">Choose a sample account and explore your side of the journey.</p>
      <ErrorNotice error={requestError} />
      <form onSubmit={submit} noValidate><ErrorSummary errors={errors} />
        <Field name="username" label="Demo username" error={errors.username}><input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="farmer, buyer or transporter" /></Field>
        <Field name="password" label="Demo password" error={errors.password}><div className="password-input"><input id="password" name="password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter the sample password" /><button type="button" className="icon-button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeSlash /> : <Eye />}</button></div></Field>
        <button className="button full-width" disabled={busy || !authReady}>{busy ? 'Opening workspace…' : isApi ? 'Sign in' : 'Enter demo'}<ArrowRight /></button>
      </form>
      <div className="demo-accounts"><h3>Pick a demo account</h3>{demoAccounts.map(account => <div className="demo-account" key={account.role}><button type="button" className="account-select" aria-label={`Use ${account.role} demo account`} onClick={() => { setUsername(account.username); setPassword(account.password); setErrors({}); setRequestError(undefined); notify(`${account.label} credentials filled in.`); }}><span><strong>{account.label}</strong><small>{account.username} / {account.password}</small></span><ArrowRight size={18} /></button><CopyButton text={`Username: ${account.username}\nPassword: ${account.password}`} label={`Copy ${account.label.toLowerCase()} credentials`} /></div>)}</div>
      <p className="small muted login-note"><CheckCircle />{isApi ? 'These public demo accounts are verified by the API. They are not private production accounts.' : 'These public credentials only select a demo role. No real account, payment or shipment is created.'}</p><Link to="/" className="inline-link">Back to home<ArrowRight /></Link>
    </div>
  </section>;
}
