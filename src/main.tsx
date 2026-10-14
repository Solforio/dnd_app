import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { App } from './App';
import { startSession } from './data/session';
import './styles/tokens.css';
import './styles/global.css';
import './styles/fantasy.css';
import './styles/extras.css';

startSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
