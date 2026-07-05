const base = process.env.PUBLIC_URL || '';

const NAV = [
  { route: 'jobs', label: 'Jobs' },
  { route: 'about', label: 'About' },
  { route: 'post', label: 'Post a job' },
];

export function Header({ route }: { route: string }) {
  return (
    <header className="topbar">
      <a className="brand" href="#/jobs" aria-label="International Student Job Board — home">
        <img
          className="brand-logo"
          src={`${base}/icons/logo.svg`}
          alt=""
          width={40}
          height={40}
        />
        <span className="brand-title">International Student Job Board</span>
      </a>

      <nav className="topnav" aria-label="Primary">
        {NAV.map((item) => (
          <a
            key={item.route}
            href={`#/${item.route}`}
            className={`topnav-link${route === item.route ? ' is-active' : ''}`}
            aria-current={route === item.route ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
