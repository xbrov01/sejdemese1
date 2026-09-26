import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Registrace Service Workeru pro podporu PWA a systémových notifikací na mobilu (Android / iOS / Desktop)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker úspěšně zaregistrován:', registration.scope);
      })
      .catch((error) => {
        console.warn('Registrace Service Workeru selhala:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

