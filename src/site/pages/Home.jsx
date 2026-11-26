import { Page, Check } from '../Layout.jsx';
import BeforeAfter from '../BeforeAfter.jsx';
import { content as c, Text, Img } from '../../content/content.jsx';

// Mock project feed for the portal illustration. This is an example, not site copy.
const FEED = [
  ['Demolition complete, tub removed', 'Mon'],
  ['Plumbing rough-in inspected', 'Wed'],
  ['Shower tile installed', 'Fri'],
  ['Double vanity and linen closet', 'Next Tue', true],
];

const H = c.home;

export default function Home({ active }) {
  return (
    <Page name="home" active={active}>
      <div className="hero wrap">
        <div className="hero-grid">
          <div>
            <Text path="home.hero.eyebrow" as="p" className="eyebrow" />
            <h1><Text path="home.hero.titleStart" />{' '}<Text path="home.hero.titleScript" className="script" /></h1>
            <Text path="home.hero.lead" as="p" className="lead" />
            <div className="cta-row">
              <a className="btn btn-primary" href="#contact"><Text path="home.hero.primaryButton" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>
              <a className="btn btn-ghost" href="#projects"><Text path="home.hero.secondaryButton" /></a>
            </div>
            <div className="trust">
              <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>{c.home.hero.trust[0]}</div>
              <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{c.home.hero.trust[1]}</div>
              <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>{c.home.hero.trust[2]}</div>
            </div>
          </div>
          <div className="hero-photo">
            <div className="ph"><Img path="home.hero.photo" /></div>
            <div className="badge"><strong>{H.hero.badgeNumber}<span style={{ fontSize: '.5em' }}>{H.hero.badgeSuffix}</span></strong><Text path="home.hero.badgeText" /></div>
          </div>
        </div>
      </div>

      <div className="band alt">
        <div className="wrap">
          <div className="sec-head">
            <Text path="home.services.eyebrow" as="p" className="eyebrow" />
            <Text path="home.services.title" as="h2" />
            <Text path="home.services.lead" as="p" className="lead" />
          </div>
          <div className="bento">
            <a className="cell photo k" href="#services-kitchen"><Img path="home.services.kitchen.photo" /><h3>{H.services.kitchen.title}</h3><p>{H.services.kitchen.text}</p></a>
            <a className="cell photo b2" href="#services-bath"><Img path="home.services.bath.photo" /><h3>{H.services.bath.title}</h3><p>{H.services.bath.text}</p></a>
            <a className="cell" href="#services-addition"><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21V10l9-6 9 6v11" /><path d="M14 21v-7h7" /></svg></span><h3>{H.services.addition.title}</h3><p>{H.services.addition.text}</p></a>
            <a className="cell navy" href="#services-outdoor"><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg></span><h3>{H.services.outdoor.title}</h3><p>{H.services.outdoor.text}</p></a>
            <a className="cell" href="#contact" style={{ gridColumn: '1/-1', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px 24px', background: 'var(--aqua-soft)', borderColor: 'var(--aqua-soft)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
                <span className="ic" style={{ background: 'var(--surface)', margin: 0, flex: 'none' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H8l-4 4z" /></svg></span>
                <span style={{ display: 'grid', gap: 4, minWidth: 0 }}><h3>{H.services.ctaTitle}</h3><p>{H.services.ctaText}</p></span>
              </span>
              <span className="btn btn-primary" style={{ flex: 'none' }}>{H.services.ctaButton}</span>
            </a>
          </div>
        </div>
      </div>

      <div className="band">
        <div className="wrap ba-wrap">
          <BeforeAfter />
        </div>
      </div>

      <div className="band alt">
        <div className="wrap">
          <div className="sec-head">
            <Text path="home.steps.eyebrow" as="p" className="eyebrow" />
            <Text path="home.steps.title" as="h2" />
          </div>
          <div className="steps">
            {H.steps.list.map(s => <div className="step" key={s.title}><h3>{s.title}</h3><p>{s.text}</p></div>)}
          </div>
        </div>
      </div>

      <div className="band">
        <div className="wrap split">
          <div>
            <Text path="home.portal.eyebrow" as="p" className="eyebrow" />
            <Text path="home.portal.title" as="h2" style={{ marginTop: 12 }} />
            <Text path="home.portal.lead" as="p" className="lead" style={{ marginTop: 14 }} />
            <ul className="check">
              {H.portal.checks.map(t => <li key={t}><Check /><span>{t}</span></li>)}
            </ul>
            <div className="cta-row"><a className="btn btn-ghost" href="https://vimeo.com/coconstruct/review/342806559/2a1fd44177" target="_blank" rel="noopener"><Text path="home.portal.videoButton" /></a></div>
          </div>
          <div className="portal" aria-label="Example project portal">
            <div className="portal-h"><span>Master bath remodel</span><span className="pill">Example</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.88rem', color: 'var(--ink-2)' }}><span>Progress</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>68%</span></div>
            <div className="bar"><i></i></div>
            <div className="feed">
              {FEED.map(([t, when, todo]) => <div key={t}><span className={'dot' + (todo ? ' todo' : '')}></span><span>{t}</span><time>{when}</time></div>)}
            </div>
          </div>
        </div>
      </div>

      <div className="band alt">
        <div className="wrap">
          <div className="sec-head"><Text path="home.reviews.eyebrow" as="p" className="eyebrow" /><Text path="home.reviews.title" as="h2" /></div>
          <div className="quotes">
            <figure className="quote big" style={{ margin: 0 }}>
              <div className="marks">“</div>
              <blockquote>{H.reviews.featured.text}</blockquote>
              <figcaption className="who"><span className="av">{H.reviews.featured.initials}</span><span><b>{H.reviews.featured.name}</b><small>{H.reviews.featured.place}</small></span></figcaption>
            </figure>
            <figure className="quote" style={{ margin: 0 }}>
              <div className="chips">{H.reviews.second.chips.map(t => <span className="chip" key={t}>{t}</span>)}</div>
              <blockquote>{H.reviews.second.text}</blockquote>
              <figcaption className="who"><span className="av">{H.reviews.second.initials}</span><span><b>{H.reviews.second.name}</b><small>{H.reviews.second.place}</small></span></figcaption>
            </figure>
          </div>
          <div className="cta-row"><a className="btn btn-ghost" href="#reviews"><Text path="home.reviews.readAll" /></a></div>
        </div>
      </div>

      <div className="band">
        <div className="wrap">
          <div className="cta-band">
            <div>
              <Text path="home.cta.title" as="h2" />
              <Text path="home.cta.text" as="p" />
            </div>
            <div className="cta-row" style={{ margin: 0 }}><a className="btn btn-primary" href="#contact"><Text path="home.cta.button" /></a></div>
          </div>
        </div>
      </div>
    </Page>
  );
}
