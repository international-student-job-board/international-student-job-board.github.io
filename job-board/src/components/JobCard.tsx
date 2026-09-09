import { Job, hasSalary, salaryRangeAud, jobLocation } from '../types';
import { formatDate, formatSalary } from '../format';

interface Props {
  job: Job;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function JobCard({ job, selected, onSelect }: Props) {
  const pay = hasSalary(job.salary) ? salaryRangeAud(job.salary) : null;
  const meta = [
    job.type,
    job.workArrangement,
    jobLocation(job),
    pay ? `${formatSalary(pay[0], pay[1], 'AUD')}${job.salary.isEstimate ? ' est.' : ''}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const hasFlags =
    job.company.accreditedSponsor || job.company.hiresInternationalStudents ||
    job.invitedScore !== undefined;
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
      </button>
    </li>
  );
}
