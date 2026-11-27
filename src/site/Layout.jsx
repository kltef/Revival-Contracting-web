import { useEffect, useRef, useState } from 'react';
import { Text, useContent, useEditing, telHref } from '../content/content.jsx';
import { staffState } from '../lib/staff.mjs';

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

// 'signedIn' | 'returning' | 'public', from what this browser has stored (see src/lib/staff.mjs)
function useStaff() {
  const [state, setState] = useState(() => staffState(globalThis.localStorage));
  useEffect(() => {
    const check = () => setState(staffState(globalThis.localStorage));
    addEventListener('storage', check); // signed in or out in another tab
    addEventListener('focus', check);
    return () => { removeEventListener('storage', check); removeEventListener('focus', check); };
  }, []);
  return state;
}

const GearIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
const PencilIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>;

export function Header({ page, menuOpen, setMenuOpen }) {
  const navRef = useRef(null), btnRef = useRef(null);
  const staff = useStaff();
  const editing = Boolean(useEditing());

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
          {/* Only for the people who run the site: nothing shows for the public */}
          {/* (between tablet and wide desktop these shrink to icons; the label stays for screen readers) */}
          {staff === 'signedIn' && !editing && <a className="staff staff-first" href="?edit" title="Edit website"><PencilIcon /><span>Edit website</span></a>}
          {staff === 'signedIn' && <a className={'staff' + (editing ? ' staff-first' : '')} href="admin/" title="Admin"><GearIcon /><span>Admin</span></a>}
          {staff === 'returning' && <a className="staff staff-first" href="admin/">Sign in</a>}
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
  const B = useContent().business;
  return (
    <footer>
      <div className="wrap">
        <div className="fgrid">
          <div>
            <Brand />
            <Text path="business.footerTagline" as="p" style={{ marginTop: 16, maxWidth: '34ch' }} multiline />
          </div>
          <div><h4>Explore</h4><a href="#services">Services</a><a href="#projects">Projects</a><a href="#about">About</a><a href="#reviews">Reviews</a></div>
          <div><h4>Services</h4><a href="#services-kitchen">Kitchens</a><a href="#services-bath">Bathrooms</a><a href="#services-outdoor">Lanais &amp; summer kitchens</a><a href="#services-addition">Additions</a></div>
          <div><h4>Visit</h4><Text path="business.addressLines" as="p" multiline />
            <a href={'mailto:' + B.email} style={{ overflowWrap: 'anywhere' }}><Text path="business.email" /></a>
            <a href={telHref(B.phone)} style={{ marginTop: 8 }}><Text path="business.phone" /></a>
            <a href="#contact" style={{ marginTop: 8, color: '#8FD3E3', fontWeight: 600 }}>Get a free estimate →</a></div>
        </div>
        <div className="legal"><Text path="business.legal" /><Text path="business.license" /></div>
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
