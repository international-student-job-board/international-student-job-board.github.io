import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { loadOccupations, loadOscaOccupations, loadInvitationRound } from './references';
import { loadConstants } from './constants';
import { loadRecentJobs } from './jobs';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

/**
 * The occupation reference and the pick-lists are fetched before the first render, which is
 * what lets every caller stay synchronous - resolveOccupation is used inside filtering and
 * inside render, and threading a promise through all of that to save two small files at
 * boot would not be a trade worth making.
 */
// The newest few days of roles start downloading now, alongside the reference data rather than
// after it: the board's first paint is these roles, so they are the one thing worth not
// queueing behind the rest.
void loadRecentJobs();

Promise.allSettled([
  loadOccupations(),
  loadOscaOccupations(),
  loadConstants(),
  loadInvitationRound(),
]).then((results) => {
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
