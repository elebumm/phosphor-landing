import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Cloudflare Web Analytics (cookie-free page views), only on the live site so local previews aren't counted.
// The token is public by design.
if (location.hostname === 'phosphorai.app') {
  const beacon = document.createElement('script');
  beacon.defer = true;
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.setAttribute('data-cf-beacon', JSON.stringify({ token: '1d1445af458c49d5a86a41c93132ec9d' }));
  document.head.appendChild(beacon);
}

const root = document.getElementById('root');
// Production builds ship prerendered markup; the dev server starts empty.
if (root.firstElementChild) hydrateRoot(root, <App />);
else createRoot(root).render(<App />);
