import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ChunkRecoveryBoundary } from './components/ChunkRecoveryBoundary';
import { registerPwaServiceWorker } from './lib/pwa';
import { initResumePrint } from './lib/resumePrint';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

initResumePrint();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ChunkRecoveryBoundary>
      <App />
    </ChunkRecoveryBoundary>
  </React.StrictMode>
);

registerPwaServiceWorker();
