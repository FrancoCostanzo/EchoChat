import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './lib/i18n';
import './index.css';

// HeroUI v3.1 (beta): every <Tooltip> logs a dev-only "PressResponder was
// rendered without a pressable child" warning — even with the documented
// <Tooltip><Button/></Tooltip> pattern, because HeroUI's Button doesn't
// consume React Aria's PressResponder context yet. Silence that exact
// message in dev until the upstream fix lands; everything else passes through.
if (import.meta.env.DEV) {
  const warn = console.warn.bind(console);
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].startsWith('A PressResponder was rendered without a pressable child')) return;
    warn(...args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
