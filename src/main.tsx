import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { loadAdSense } from './utils/adsense';

// No-op unless VITE_ADSENSE_CLIENT is set.
loadAdSense();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
