import { useMemo } from 'react';
import { browseLinks, BrowseLink } from '../landing';
import { Job } from '../types';
import { trackEvent } from '../analytics';

function Group({ title, section, links }: { title: string; section: string; links: BrowseLink[] }) {
  if (!links.length) return null;
  return (
    <section>
      <h2 className="browse-title">{title}</h2>
      <ul className="browse-list">
        {links.map((link) => (
          <li key={link.path}>
            <a
              href={link.path}
              onClick={() =>
                trackEvent('browse_link', { section, destination: link.path, roles: link.count })
              }
            >
              {link.label}
            </a>
            <span className="browse-count">{link.count.toLocaleString('en-AU')}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Ways into the board, by what a person searches for: a capital city, a state, a kind of work, an
 * industry, employers that sponsor visas. Each is a real link to its own address - the same
 * address the board's filters write when set by hand - so a reader can jump to one and a crawler
 * can follow it.
 */
export function BrowseLinks({ jobs }: { jobs: Job[] }) {
  const groups = useMemo(() => browseLinks(jobs), [jobs]);
  const { cities, states, types, industries, levels, sponsors } = groups;
  if (Object.values(groups).every((links) => !links.length)) return null;

  return (
    <nav
      className="browse"
      aria-label="Browse jobs by city, state, kind of work, industry and visa sponsorship"
    >
      <div className="browse-inner">
        {/* What this audience looks for first - where, and who sponsors - then the rest. */}
        <Group title="Jobs by city" section="city" links={cities} />
        <Group title="Jobs by state" section="state" links={states} />
        <Group title="Visa sponsorship" section="sponsor" links={sponsors} />
        <Group title="Jobs by level" section="level" links={levels} />
        <Group title="Jobs by kind of work" section="type" links={types} />
        <Group title="Jobs by industry" section="industry" links={industries} />
      </div>
    </nav>
  );
}
