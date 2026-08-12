import { Job } from '../types';
import { formatDate } from '../format';

interface Props {
  job: Job;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function JobCard({ job, selected, onSelect }: Props) {
  return (
    <li>
      <button
        type="button"
        className={`job-card${selected ? ' is-selected' : ''}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(job.id)}
      >
        <span className="job-card-title">{job.title}</span>
        <span className="job-card-company">{job.company}</span>

        <span className="job-card-meta">
          {[job.jobLevel, job.type, ...job.arrangements].filter(Boolean).join(' · ')}
        </span>
        {/* The application window, which is what decides whether a reader can
            still act on this card at all. */}
        <span className="job-card-meta job-card-posted">
          {[
            job.posted ? `Open ${formatDate(job.posted)}` : '',
            job.closes ? `closes ${formatDate(job.closes)}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || 'Application dates not specified'}
        </span>
        {job.employerSponsored && (
          <span className="job-card-flags">
            <span className="flag flag-sponsor">Visa sponsorship available</span>
          </span>
        )}
      </button>
    </li>
  );
}
