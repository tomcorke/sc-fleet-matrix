// import "./main.css";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { loadData } from '../data';
import { App } from './App';

const container = document.getElementById('root');
const root = createRoot(container as HTMLDivElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
