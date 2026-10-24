import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/figtree';
import './style.css';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
