import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Header, Footer, MobileBar } from './Layout.jsx';
import Home from './pages/Home.jsx';
import Services from './pages/Services.jsx';
import Projects from './pages/Projects.jsx';
import About from './pages/About.jsx';
import Reviews from './pages/Reviews.jsx';
import Contact from './pages/Contact.jsx';

const PAGES = ['home', 'services', 'projects', 'about', 'reviews', 'contact'];

// #services-<key> opens Services scrolled to that service; #write-review[-<project>] opens the review form
function parseHash(hash) {
  let page = (hash || '#home').slice(1), sub = null, review = null;
  const m = page.match(/^services-([a-z]+)$/);
  if (m) { page = 'services'; sub = m[1]; }
  const w = page.match(/^write-review(?:-([a-z]+))?$/);
  if (w) { page = 'reviews'; review = w[1] || ''; }
  if (!PAGES.includes(page)) page = 'home';
  return { page, sub, review };
}

function scrollToService(sub) {
  // find the service by its key, so this works no matter how the list has been reordered
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = () => {
    const el = document.querySelector('article.svc[data-service="' + sub + '"]');
    if (!el) return;
    const off = document.querySelector('header.top').offsetHeight + 12;
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - off), behavior: smooth ? 'smooth' : 'auto' });
    // fallback for phones/in-app viewers where the window itself can't scroll
    setTimeout(() => { if (Math.abs(el.getBoundingClientRect().top - off) > 60) el.scrollIntoView({ block: 'start' }); }, smooth ? 800 : 80);
  };
  requestAnimationFrame(() => requestAnimationFrame(go));
}

export default function App() {
  // n changes on every navigation, even back to the same hash, so effects re-run
  const [route, setRoute] = useState(() => ({ ...parseHash(location.hash), n: 0 }));
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const reroute = () => setRoute(r => ({ ...parseHash(location.hash), n: r.n + 1 }));
    // clicking a shortcut link for the hash you're already on doesn't fire hashchange
    const onClick = e => {
      const a = e.target.closest?.('a[href^="#services-"],a[href^="#write-review"]');
      if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); reroute(); }
    };
    window.addEventListener('hashchange', reroute);
    document.addEventListener('click', onClick);
    return () => { window.removeEventListener('hashchange', reroute); document.removeEventListener('click', onClick); };
  }, []);

  useLayoutEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (route.sub) scrollToService(route.sub);
  }, [route]);

  const at = name => route.page === name;
  // a new object only when the route changes, so the review form opens once per visit to #write-review
  const reviewRequest = useMemo(() => (route.review === null ? null : { project: route.review, n: route.n }), [route]);

  return (
    <>
      <Header page={route.page} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main>
        <Home active={at('home')} />
        <Services active={at('services')} />
        <Projects active={at('projects')} />
        <About active={at('about')} />
        <Reviews active={at('reviews')} reviewRequest={reviewRequest} />
        <Contact active={at('contact')} />
      </main>
      <Footer />
      <MobileBar />
    </>
  );
}
