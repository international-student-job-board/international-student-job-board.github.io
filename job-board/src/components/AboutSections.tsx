import { OUTBOUND, outboundHref } from '../outbound';
const REFERENCES = [
  { label: 'Study Melbourne', url: 'https://www.studymelbourne.vic.gov.au/' },
  { label: 'Study VIC', url: 'https://www.study.vic.gov.au/' },
  { label: 'Skilled occupation list & ANZSCO list', url: 'https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list' },
  { label: 'Occupation & industry profiles', url: 'https://www.jobsandskills.gov.au/data/occupation-and-industry-profiles/occupations' },
  { label: 'ANZSCO - Australian and New Zealand Standard Classification of Occupations', url: 'https://www.abs.gov.au/statistics/classifications/anzsco-australian-and-new-zealand-standard-classification-occupations/2022#what-s-new'},
  { label: 'Skilled employment sponsors - 2025', url: 'https://www.homeaffairs.gov.au/foi/files/2025/fa-250101229-document-released.PDF'},
];

// Written from the same seat the readers are in, rather than a government page: networking,
// resumes, finding roles and interviews, by an international STEM student in Australia.
const GUIDES = [
  {
    label: '🐝 My Two Rupees',
    url: 'https://medium.com/@milindi.beeloud/list/my-two-rupees-2311414b6960',
  },
  {
    label: 'Levels.fyi',
    url: 'https://www.levels.fyi/?tab=levels',
  },
  {
    label: 'Glassdoor company reviews',
    url: 'https://www.glassdoor.com.au/Reviews/index.htm',
  },
];

export function Resources() {
  return (
    <section className="about-section" aria-labelledby="refs-heading">
      <h2 id="refs-heading">Resources</h2>

      <p>Guides</p>
      <ul className="ref-list">
        {GUIDES.map((guide) => (
          <li key={guide.url}>
            <a href={outboundHref(guide.url, 'resources')} {...OUTBOUND}>
              {guide.label}
            </a>
          </li>
        ))}
      </ul>

      <p>References</p>
      <ul className="ref-list">
        {REFERENCES.map((ref) => (
          <li key={ref.url}>
            <a href={ref.url} {...OUTBOUND}>
              {ref.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
