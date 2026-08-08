const REFERENCES = [
  { label: 'Study Melbourne', url: 'https://www.studymelbourne.vic.gov.au/' },
  { label: 'Study VIC', url: 'https://www.study.vic.gov.au/' },
  { label: 'Skilled occupation list & ANZSCO list', url: 'https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list' },
  { label: 'Occupation & industry profiles', url: 'https://www.jobsandskills.gov.au/data/occupation-and-industry-profiles/occupations' },
];

export function Resources() {
  return (
    <section className="about-section" aria-labelledby="refs-heading">
      <h2 id="refs-heading">Resources</h2>
      <p>Be well read, y'all</p>
      <ul className="ref-list">
        {REFERENCES.map((ref) => (
          <li key={ref.url}>
            <a href={ref.url} target="_blank" rel="noopener noreferrer">
              {ref.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
