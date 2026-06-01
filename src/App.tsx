import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { darkTheme } from './styles/theme';
import AppRouter from './router';

/** MSW initialization wrapper */
function MswProvider({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) {
      import('./mock/browser').then(({ initMockBrowser }) => {
        initMockBrowser().then(() => setMswReady(true));
      });
    } else {
      setMswReady(true);
    }
  }, []);

  if (!mswReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary text-text-secondary">
        加载中...
      </div>
    );
  }

  return <>{children}</>;
}

/** Loading fallback for lazy routes */
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full bg-bg-primary text-text-muted text-sm">
      页面加载中...
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <MswProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <AppRouter />
          </Suspense>
        </BrowserRouter>
      </MswProvider>
    </ThemeProvider>
  );
}
