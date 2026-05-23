
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UnitsProvider } from './contexts/UnitsContext';
import { TicketsProvider } from './contexts/TicketsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { logErrorToSupabase } from './services/logService';

// Global error handlers
window.onerror = (message, source, lineno, colno, error) => {
  logErrorToSupabase(error || message.toString(), `Source: ${source}, Line: ${lineno}, Col: ${colno}`);
  return false;
};

window.onunhandledrejection = (event) => {
  logErrorToSupabase(event.reason, 'Unhandled Promise Rejection');
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ThemeProvider>
    <UnitsProvider>
      <TicketsProvider>
        <App />
      </TicketsProvider>
    </UnitsProvider>
  </ThemeProvider>
);
