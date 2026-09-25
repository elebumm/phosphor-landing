import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const root = document.getElementById('root');
// Production builds ship prerendered markup; the dev server starts empty.
if (root.firstElementChild) hydrateRoot(root, <App />);
else createRoot(root).render(<App />);
