import { MouseEvent as ReactMouseEvent } from 'react';
import { Job, hasSalary, jobLocation } from '../types';
import { formatDate, formatSalaryAud } from '../format';
import { pathFor } from '../routes';

interface Props {
  job: Job;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function JobCard({ job, selected, onSelect }: Props) {
  const meta = [
    job.type,
    job.workArrangements.join('/'),
    jobLocation(job),
    hasSalary(job.salary) ? formatSalaryAud(job.salary) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const hasFlags =
    job.company.accreditedSponsor ||
    job.company.hiresInternationalStudents ||
    job.invitedScore !== undefined;

  // A real link, not a button, so right-click "open in new tab", middle-click and
  // ctrl/cmd-click all just work. Only a plain, unmodified left click is worth
  // taking over for the in-place select-and-show-detail behaviour; everything else
  // is left to the browser. Same guard useAppNavigation's own document-level
  // handler uses, so the two never fight over the same click.
  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(job.id);
  };

  return (
    <li>
      <a
        href={pathFor('jobs', job.id)}
        className={`job-card${selected ? ' is-selected' : ''}`}
        aria-current={selected ? 'true' : undefined}
        onClick={handleClick}
      >
        <span className="job-card-title">{job.title}</span>
        <span className="job-card-company">{job.company.name}</span>

        {meta && <span className="job-card-meta">{meta}</span>}
        <span className="job-card-meta job-card-posted">
          {job.posted ? `Posted ${formatDate(job.posted)}` : 'Not specified'}
        </span>
        {hasFlags && (
          <span className="job-card-flags">
            {job.company.accreditedSponsor && (
              <span className="flag flag-sponsor">Accredited sponsor</span>
            )}
            {job.company.hiresInternationalStudents && (
              <span className="flag flag-sponsor">Hires international students and graduates</span>
            )}
            {job.invitedScore !== undefined && (
              <span className="flag flag-sponsor">In the latest invitation round</span>
            )}
          </span>
        )}
      </a>
    </li>
  );
}
