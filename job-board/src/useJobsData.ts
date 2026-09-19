import { useEffect, useState } from 'react';
import { Job } from './types';
import { loadJobs, loadRecentJobs } from './jobs';
import { loadCompanies } from './companies';

export type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * `jobs` is the whole board and only fills once `status` is 'ready'. `previewJobs` is the
 * newest few days, which arrive far sooner - it is a head start for what to show while the
 * board loads, and is never the board itself: nothing filters, counts or offers options from
 * it.
 */
export function useJobsData(): { jobs: Job[]; previewJobs: Job[]; status: LoadStatus } {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [previewJobs, setPreviewJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    let live = true;
    loadRecentJobs().then((recent) => live && setPreviewJobs(recent));
    loadJobs()
      .then((data) => {
        if (!live) return;
        setJobs(data);
        setStatus('ready');
      })
      .catch(() => live && setStatus('error'));
    return () => {
      live = false;
    };
  }, []);

  return { jobs, previewJobs, status };
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
