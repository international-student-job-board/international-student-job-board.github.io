import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { loadOccupations, loadOscaOccupations } from './references';
import { loadConstants } from './constants';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

/**
 * The occupation reference and the pick-lists are fetched before the first render, which is
 * what lets every caller stay synchronous — resolveOccupation is used inside filtering and
 * inside render, and threading a promise through all of that to save two small files at
 * boot would not be a trade worth making.
 */
Promise.allSettled([loadOccupations(), loadOscaOccupations(), loadConstants()]).then((results) => {
  results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .forEach((r) => console.warn('Reference data unavailable:', r.reason));

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

reportWebVitals();
