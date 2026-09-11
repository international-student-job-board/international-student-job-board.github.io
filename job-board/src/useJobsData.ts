import { useEffect, useState } from 'react';
import { Job } from './types';
import { loadJobs } from './jobs';
import { loadCompanies } from './companies';

export type LoadStatus = 'loading' | 'ready' | 'error';

export function useJobsData(): { jobs: Job[]; status: LoadStatus } {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    loadJobs()
      .then((data) => {
        setJobs(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  return { jobs, status };
}

/** How many startups are hiring, fetched only for the "no roles listed yet" empty state -
 * everywhere else the board only needs the jobs themselves. */
export function useCompanyCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadCompanies()
      .then((all) => live && setCount(all.length))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [enabled]);

  return count;
}
