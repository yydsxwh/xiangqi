import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MatchApp } from './ui/MatchApp.tsx';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('缺少根节点');

createRoot(root).render(
  <StrictMode>
    <MatchApp />
  </StrictMode>,
);
