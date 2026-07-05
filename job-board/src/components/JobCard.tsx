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
        <span className="job-card-company">{job.company}</span>
        <span className="job-card-title">{job.title}</span>
        <span className="job-card-meta">
          {[job.jobLevel, job.type, job.arrangement].filter(Boolean).join(' · ')}
        </span>
        <span className="job-card-meta job-card-posted">Posted {formatDate(job.posted)}</span>
        {job.employerSponsored && (
          <span className="job-card-flags">
            <span className="flag flag-sponsor">Visa sponsorship available</span>
          </span>
        )}
      </button>
    </li>
  );
}
