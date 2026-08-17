// What the page tells a search engine, and what it tells someone pasting a link into a
// chat.

import { Job, jobLocation } from './types';
import { Route } from './routes';
import { SITE_NAME, SITE_URL } from './links';
import { formatDate } from './format';
import { resolveOccupations } from './references';

export interface PageMeta {
  title: string;
  description: string;
  /** Absolute, so it can serve as the canonical and the preview URL alike. */
  url: string;
}

const HOME_DESCRIPTION =
  'Curated startup and scaleup jobs across Australia for international students ' +
  'and recent graduates, mapped with the migration pathways and visa requirements.';

/** Title and description for an address. */
export function metaFor(route: Route, job: Job | null, origin: string): PageMeta {
  const at = (path: string) => `${origin}${path}`;

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

  switch (route) {
    case 'companies':
      return {
        title: `Australian startups and scaleups hiring | ${SITE_NAME}`,
        description:
          'Australian startups and scaleups that are hiring, with their state, industry, ' +
          'size, stage and whether they are an accredited visa sponsor.',
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
          'How this board works, and the official Home Affairs and ABS sources ' +
          'behind its visa, occupation and skills-assessment information.',
        url: at('/about'),
      };
    default:
      return {
        title: `${SITE_NAME} - Australian startup jobs for international students`,
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

/** schema.org JobPosting for the role being read. */
export function jobPostingSchema(job: Job, url: string, validThrough: string): object {
  const occupations = resolveOccupations(job)
    .map((o) => o.name)
    .filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: [
      `${job.title} at ${job.company.name}`,
      jobLocation(job) ? ` in ${jobLocation(job)}` : '',
      '. ',
      job.company.tagline ? `${job.company.tagline}. ` : '',
      occupations.length ? `ANZSCO occupation: ${occupations.join(', ')}. ` : '',
      job.posted ? `Listed ${formatDate(job.posted)}.` : '',
    ].join(''),
    identifier: {
      '@type': 'PropertyValue',
      name: SITE_NAME,
      value: job.id,
    },
    ...(job.posted ? { datePosted: job.posted } : {}),
    ...(validThrough ? { validThrough } : {}),
    ...(job.type ? { employmentType: job.type } : {}),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company.name,
      ...(job.company.website ? { sameAs: job.company.website } : {}),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(job.city ? { addressLocality: job.city } : {}),
        addressRegion: 'VIC',
        addressCountry: 'AU',
      },
    },
    directApply: false,
    url,
  };
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
