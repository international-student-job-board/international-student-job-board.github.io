import { Job, jobLocation } from '../types';
import { formatDate } from '../format';

interface Props {
  job: Job;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function JobCard({ job, selected, onSelect }: Props) {
  const meta = [job.type, jobLocation(job)].filter(Boolean).join(' · ');
  return (
    <li>
      <button
        type="button"
        className={`job-card${selected ? ' is-selected' : ''}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(job.id)}
      >
        <span className="job-card-title">{job.title}</span>
        <span className="job-card-company">{job.company.name}</span>

        {meta && <span className="job-card-meta">{meta}</span>}
        <span className="job-card-meta job-card-posted">
          {job.posted ? `Posted ${formatDate(job.posted)}` : 'Not specified'}
        </span>
        {/* Only the affirmative answer earns a badge. "Not an accredited
            sponsor" is a fact about the employer, not a feature of the role,
            and a badge for it would read as a warning the board can't support. */}
        {job.company.accreditedSponsor && (
          <span className="job-card-flags">
            <span className="flag flag-sponsor">Accredited sponsor</span>
          </span>
        )}
      </button>
    </li>
  );
}
