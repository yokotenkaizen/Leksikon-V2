import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Gracefully suppress benign WebSocket and Vite HMR connection failures in the sandbox environment.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || '');
    if (
      reason.includes('WebSocket') ||
      reason.includes('websocket') ||
      reason.includes('vite') ||
      reason.includes('HMR') ||
      reason.includes('ws://') ||
      reason.includes('wss://')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const message = event.message || '';
    const errorMsg = event.error?.message || '';
    if (
      message.includes('WebSocket') ||
      message.includes('websocket') ||
      message.includes('vite') ||
      message.includes('HMR') ||
      errorMsg.includes('WebSocket') ||
      errorMsg.includes('websocket')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.error('SW registration failed: ', registrationError);
    });
  });
}
