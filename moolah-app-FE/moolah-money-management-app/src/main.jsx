console.log("VITE_API_BASE_URL =", import.meta.env.VITE_API_BASE_URL);
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';

import CssBaseline from '@mui/material/CssBaseline';
import { CssVarsProvider } from '@mui/material/styles';
import theme from './theme.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CssVarsProvider theme={theme} defaultMode="system" modeStorageKey="mui-mode">
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CssVarsProvider>
  </StrictMode>
);