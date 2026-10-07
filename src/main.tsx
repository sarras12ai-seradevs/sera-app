import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence dev HMR WebSocket unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const str = typeof reason === 'string' ? reason : reason?.message || String(reason || '');
    if (
      str.includes('WebSocket') ||
      str.includes('ws:') ||
      str.includes('wss:') ||
      str.includes('vite') ||
      str.includes('hmr') ||
      str.includes('HMR')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const str = event.message || '';
    if (
      str.includes('WebSocket') ||
      str.includes('ws:') ||
      str.includes('wss:') ||
      str.includes('vite') ||
      str.includes('hmr')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
