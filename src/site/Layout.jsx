import { useEffect, useRef } from 'react';

export function Page({ name, active, children }) {
  return <section className={'page' + (active ? ' active' : '')} id={'p-' + name} data-page={name}>{children}</section>;
}

export function PageHead({ crumb, children }) {
  return (
    <div className="phead"><div className="wrap">
      <p className="crumbs"><a href="#home">Home</a> / {crumb}</p>
      {children}
    </div></div>
  );
}

const NAV = [['home', 'Home'], ['services', 'Services'], ['projects', 'Projects'], ['about', 'About'], ['reviews', 'Reviews'], ['contact', 'Contact']];

export function Brand({ className = 'brand', label }) {
  return (
    <a className={className} href="#home" aria-label={label}>
      <span className="tile"><span>R</span></span>
      <span className="brand-name"><b>Revival</b><small>CONTRACTING &amp; REMODELING</small></span>
    </a>
  );
}

export function Header({ page, menuOpen, setMenuOpen }) {
  const navRef = useRef(null), btnRef = useRef(null);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false); };
    const onClick = e => {
      if (!navRef.current.contains(e.target) && !btnRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick); };
  }, [setMenuOpen]);

  return (
    <header className="top">
      <div className="wrap nav">
        <Brand label="Revival Contracting & Remodeling home" />
        <nav className={'links' + (menuOpen ? ' open' : '')} id="links" aria-label="Main" ref={navRef}>
          {NAV.map(([key, label]) => (
            <a key={key} href={'#' + key} aria-current={page === key ? 'page' : undefined}>{label}</a>
          ))}
        </nav>
        <a className="btn btn-primary desk" href="#contact">Free estimate</a>
        <button className="menu-btn" id="menuBtn" ref={btnRef} aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen} aria-controls="links" onClick={() => setMenuOpen(!menuOpen)}>
          <span className="bars" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="fgrid">
          <div>
            <Brand />
            <p style={{ marginTop: 16, maxWidth: '34ch' }}>Residential remodeling in The Villages and Wildwood, Florida. It starts with a vision.</p>
          </div>
          <div><h4>Explore</h4><a href="#services">Services</a><a href="#projects">Projects</a><a href="#about">About</a><a href="#reviews">Reviews</a></div>
          <div><h4>Services</h4><a href="#services-kitchen">Kitchens</a><a href="#services-bath">Bathrooms</a><a href="#services-outdoor">Lanais &amp; summer kitchens</a><a href="#services-addition">Additions</a></div>
          <div><h4>Visit</h4><p>11635 CR 108<br />Oxford, FL 34484</p>
            <a href="mailto:Dan@Revival-Contracting.com" style={{ overflowWrap: 'anywhere' }}>Dan@Revival-Contracting.com</a>
            <a href="tel:+13527203787" style={{ marginTop: 8 }}>(352) 720-3787</a>
            <a href="#contact" style={{ marginTop: 8, color: '#8FD3E3', fontWeight: 600 }}>Get a free estimate →</a></div>
        </div>
        <div className="legal"><span>© 2026 Revival Contracting &amp; Remodeling</span><span>Florida licensed residential contractor · Lic. CRC1332446</span></div>
      </div>
    </footer>
  );
}

export function MobileBar() {
  return <div className="mbar"><a className="btn btn-ghost" href="tel:+13527203787">Call</a><a className="btn btn-primary" href="#contact">Free estimate</a></div>;
}

export const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
);

export const DoneIcon = () => (
  <div className="big"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg></div>
);
