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
 * Ways into the board, by what a person searches for: a city, a kind of work, employers that
 * sponsor visas. Each is a real link to its own address - the same address the board's filters
 * write when set by hand - so a reader can jump to one and a crawler can follow it.
 */
export function BrowseLinks({ jobs }: { jobs: Job[] }) {
  const { cities, types, levels, sponsors } = useMemo(() => browseLinks(jobs), [jobs]);
  if (!cities.length && !types.length && !levels.length && !sponsors.length) return null;

  return (
    <nav className="browse" aria-label="Browse jobs by city, kind of work and visa sponsorship">
      <div className="browse-inner">
        <Group title="Jobs by city" section="city" links={cities} />
        <Group title="Jobs by kind of work" section="type" links={types} />
        <Group title="Jobs by level" section="level" links={levels} />
        <Group title="Visa sponsorship" section="sponsor" links={sponsors} />
      </div>
    </nav>
  );
}
