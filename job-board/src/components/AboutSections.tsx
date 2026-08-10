const REFERENCES = [
  { label: 'Study Melbourne', url: 'https://www.studymelbourne.vic.gov.au/' },
  { label: 'Study VIC', url: 'https://www.study.vic.gov.au/' },
  { label: 'Skilled occupation list & ANZSCO list', url: 'https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list' },
  { label: 'Occupation & industry profiles', url: 'https://www.jobsandskills.gov.au/data/occupation-and-industry-profiles/occupations' },
  { label: 'ANZSCO - Australian and New Zealand Standard Classification of Occupations', url: 'https://www.abs.gov.au/statistics/classifications/anzsco-australian-and-new-zealand-standard-classification-occupations/2022#what-s-new'},
  { label: 'Skilled employment sponsors - 2025', url: 'https://www.homeaffairs.gov.au/foi/files/2025/fa-250101229-document-released.PDF'}
];

export function Resources() {
  return (
    <section className="about-section" aria-labelledby="refs-heading">
      <h2 id="refs-heading">Resources</h2>
      <p>Be well read, y'all</p>
      <ul className="ref-list">
        {REFERENCES.map((ref) => (
          <li key={ref.url}>
            <a href={ref.url} target="_blank" rel="noopener"
            referrerPolicy="strict-origin-when-cross-origin">
              {ref.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
