// What the page tells a search engine, and what it tells someone pasting a link into a
// chat.

import { Job, jobLocation } from './types';
import { Route } from './routes';
import { SITE_NAME, SITE_URL } from './links';
import { resolveOccupations } from './references';
import { MONTHS_LISTED } from './jobs';
import { jobPosting, postingInput } from './jobPosting';

/** When a listing stops being true, for the structured data's validThrough. */
export function validThroughFor(job: Job): string {
  const date = new Date(`${job.posted}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCMonth(date.getUTCMonth() + MONTHS_LISTED);
  return date.toISOString().slice(0, 10);
}

export interface PageMeta {
  title: string;
  description: string;
  /** Absolute, so it can serve as the canonical and the preview URL alike. */
  url: string;
}

const HOME_DESCRIPTION =
  'Startup and scaleup jobs across Australia, with pay and visa sponsorship info. Built for ' +
  'international students and graduates - open to everyone.';

/** Title and description for an address. */
/** A landing page's own address and heading - see src/landing.ts. */
export interface LandingMeta {
  path: string;
  heading: string;
}

export function metaFor(
  route: Route,
  job: Job | null,
  origin: string,
  landing?: LandingMeta | null
): PageMeta {
  // The address a page is served at: GitHub Pages answers /path with a 301 to /path/, so the
  // canonical has to be the slashed form or it points at a redirect (see served() in
  // scripts/seo-assets.js, which writes the same for the static pages).
  const at = (path: string) => `${origin}${path.endsWith('/') ? path : `${path}/`}`;

  if (job) {
    const where = jobLocation(job) || 'Australia';
    const occupations = resolveOccupations(job)
      .map((o) => o.name)
      .filter(Boolean);
    return {
      title: `${job.title} at ${job.company.name} - ${where} | ${SITE_NAME}`,
      description: [
        `${job.title} at ${job.company.name} in ${where}.`,
        job.type ? `${job.type}.` : '',
        occupations.length ? `ANZSCO occupation: ${occupations.join(', ')}.` : '',
        'Visa pathways and skills assessment for international students and graduates.',
      ]
        .filter(Boolean)
        .join(' '),
      url: at(`/jobs/${encodeURIComponent(job.id)}`),
    };
  }

  if (landing && route === 'jobs') {
    return {
      title: `${landing.heading} | ${SITE_NAME}`,
      description:
        `${landing.heading}: roles at Australian startups and scaleups for international ` +
        'students and graduates, with visa pathways and whether the employer is an accredited sponsor.',
      url: at(landing.path),
    };
  }

  switch (route) {
    case 'companies':
      return {
        title: `Australian startups and scaleups hiring | ${SITE_NAME}`,
        description:
          'Australian startups and scaleups that are hiring, with their state, industry, ' +
          'size, stage and whether they are an accredited visa sponsor or hire international ' +
          'students and graduates.',
        url: at('/companies'),
      };
    case 'post':
      return {
        title: `Post a job | ${SITE_NAME}`,
        description:
          'List an Australian startup role for international students and graduates. ' +
          'Every role is checked by hand before it goes up.',
        url: at('/post'),
      };
    case 'about':
      return {
        title: `About and visa resources | ${SITE_NAME}`,
        description:
          'How this board works for international students and graduates, and the official Home ' +
          'Affairs and ABS sources behind its visa, occupation and skills-assessment information.',
        url: at('/about'),
      };
    default:
      return {
        title: `Startup Jobs in Australia | ${SITE_NAME}`,
        description: HOME_DESCRIPTION,
        url: at('/'),
      };
  }
}

/** Creates the tag if it isn't there, so index.html only needs the defaults. */
function tag(selector: string, create: () => HTMLElement): HTMLElement {
  const existing = document.head.querySelector(selector);
  if (existing) return existing as HTMLElement;
  const made = create();
  document.head.appendChild(made);
  return made;
}

function meta(attribute: 'name' | 'property', key: string, content: string): void {
  const element = tag(`meta[${attribute}="${key}"]`, () => {
    const made = document.createElement('meta');
    made.setAttribute(attribute, key);
    return made;
  });
  element.setAttribute('content', content);
}

/** Writes the page's own title, description, canonical and preview tags. */
export function applyMeta({ title, description, url }: PageMeta): void {
  document.title = title;

  meta('name', 'description', description);
  const canonical = tag('link[rel="canonical"]', () => {
    const made = document.createElement('link');
    made.setAttribute('rel', 'canonical');
    return made;
  });
  canonical.setAttribute('href', url);

  // Open Graph and Twitter, so a pasted link previews as the role rather than as the site.
  meta('property', 'og:type', 'website');
  meta('property', 'og:site_name', SITE_NAME);
  meta('property', 'og:title', title);
  meta('property', 'og:description', description);
  meta('property', 'og:url', url);
  meta('name', 'twitter:card', 'summary');
  meta('name', 'twitter:title', title);
  meta('name', 'twitter:description', description);
}

/**
 * schema.org JobPosting for the role being read - built by src/jobPosting.ts, the same as the
 * static role page's (scripts/job-posting.js), so the block the app writes over it on mount says
 * exactly what the static one did.
 */
export function jobPostingSchema(job: Job, url: string, validThrough: string): object {
  return jobPosting(postingInput(job, url, validThrough));
}

/** The site itself, for the pages that aren't a single role. */
export function websiteSchema(origin: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: origin || SITE_URL,
    description: HOME_DESCRIPTION,
  };
}

/** A landing page - a list of roles for one view of the board. The static page carries the
 * fuller version, with the roles themselves; this keeps the address's own data right once the
 * app has taken over. */
export function landingSchema(meta: PageMeta, heading: string, origin: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: heading,
    description: meta.description,
    url: meta.url,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: origin || SITE_URL },
  };
}

const SCHEMA_ID = 'page-schema';

/** Swaps the page's structured data, leaving at most one block in the head. */
export function applySchema(schema: object): void {
  const script = tag(`script#${SCHEMA_ID}`, () => {
    const made = document.createElement('script');
    made.id = SCHEMA_ID;
    made.setAttribute('type', 'application/ld+json');
    return made;
  });
  script.textContent = JSON.stringify(schema);
}
