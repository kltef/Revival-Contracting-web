import { Page, Check } from '../Layout.jsx';
import BeforeAfter from '../BeforeAfter.jsx';

const STEPS = [
  ['Free estimate', 'We visit your home, listen to your vision and give you a no-obligation estimate.'],
  ['Design & selections', 'Dan helps you choose layouts, finishes, fixtures and paint colors.'],
  ['Schedule & portal', 'Your project goes on our scheduling system, with dates you can see online.'],
  ['Build & check', "Courteous crews do the work, and each trade's work is inspected before the next starts."],
  ['Final walk-through', 'We walk the finished space with you and make sure everything is right.'],
];

const FEED = [
  ['Demolition complete, tub removed', 'Mon'],
  ['Plumbing rough-in inspected', 'Wed'],
  ['Shower tile installed', 'Fri'],
  ['Double vanity and linen closet', 'Next Tue', true],
];

export default function Home({ active }) {
  return (
    <Page name="home" active={active}>
      <div className="hero wrap">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">Additions · Summer kitchens · Baths · The Villages, FL</p>
            <h1>Contracting that <span className="script">starts with a vision.</span></h1>
            <p className="lead">A third-generation residential contractor serving Wildwood and The Villages. We handle the whole job, from the free estimate to the final walk-through, and you can follow progress in real time.</p>
            <div className="cta-row">
              <a className="btn btn-primary" href="#contact">Get a free estimate
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>
              <a className="btn btn-ghost" href="#projects">See our work</a>
            </div>
            <div className="trust">
              <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>Florida licensed &amp; insured</div>
              <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>Building since 1986</div>
              <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>3rd-generation family company</div>
            </div>
          </div>
          <div className="hero-photo">
            <div className="ph"><img src="photos/hero-house.jpg" alt="Florida home with stone gables, palm trees and a paver driveway" style={{ objectPosition: 'center 60%' }} /></div>
            <div className="badge"><strong>40<span style={{ fontSize: '.5em' }}>+ yrs</span></strong><span>of contracting experience, led by owner Dan Ekberg</span></div>
          </div>
        </div>
      </div>

      <div className="band alt">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">What we build</p>
            <h2>One contractor for the whole house</h2>
            <p className="lead">From small updates to major remodels, Revival manages every trade so your project runs on one schedule.</p>
          </div>
          <div className="bento">
            <a className="cell photo k" href="#services-kitchen"><img src="photos/k-4.jpg" alt="" /><h3>Custom kitchens</h3><p>Cabinets, counters, layout changes and full kitchen, dining and entry remodels.</p></a>
            <a className="cell photo b2" href="#services-bath"><img src="photos/b-window.jpg" alt="" style={{ objectPosition: 'center 60%' }} /><h3>Bathrooms</h3><p>Walk-in showers, double vanities and complete master bath remodels.</p></a>
            <a className="cell" href="#services-addition"><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21V10l9-6 9 6v11" /><path d="M14 21v-7h7" /></svg></span><h3>Additions</h3><p>Architecturally inspired space that matches your home.</p></a>
            <a className="cell navy" href="#services-outdoor"><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg></span><h3>Lanais &amp; summer kitchens</h3><p>Enclosures and outdoor kitchens built for Florida weather.</p></a>
            <a className="cell" href="#contact" style={{ gridColumn: '1/-1', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px 24px', background: 'var(--aqua-soft)', borderColor: 'var(--aqua-soft)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
                <span className="ic" style={{ background: 'var(--surface)', margin: 0, flex: 'none' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H8l-4 4z" /></svg></span>
                <span style={{ display: 'grid', gap: 4, minWidth: 0 }}><h3>Not sure where to start?</h3><p>Book a free, no-obligation estimate and we’ll talk through options at your home.</p></span>
              </span>
              <span className="btn btn-primary" style={{ flex: 'none' }}>Book an estimate</span>
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
            <p className="eyebrow">How it works</p>
            <h2>From first call to final walk-through</h2>
          </div>
          <div className="steps">
            {STEPS.map(([h, p]) => <div className="step" key={h}><h3>{h}</h3><p>{p}</p></div>)}
          </div>
        </div>
      </div>

      <div className="band">
        <div className="wrap split">
          <div>
            <p className="eyebrow">Always in the loop</p>
            <h2 style={{ marginTop: 12 }}>Track your project in real time</h2>
            <p className="lead" style={{ marginTop: 14 }}>Revival runs on modern scheduling software, on site and in the office. Clients get an easy online portal with live progress updates.</p>
            <ul className="check">
              <li><Check /><span>See which trade is coming and when</span></li>
              <li><Check /><span>Review selections and approve changes online</span></li>
              <li><Check /><span>Photos and notes as the work progresses</span></li>
            </ul>
            <div className="cta-row"><a className="btn btn-ghost" href="https://vimeo.com/coconstruct/review/342806559/2a1fd44177" target="_blank" rel="noopener">Watch the portal video</a></div>
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
          <div className="sec-head"><p className="eyebrow">Reviews</p><h2>Trusted by homeowners and neighbors</h2></div>
          <div className="quotes">
            <figure className="quote big" style={{ margin: 0 }}>
              <div className="marks">“</div>
              <blockquote>Dan is “old school” when it comes to his trade; he insists on quality of workmanship and doing things right the first time.</blockquote>
              <figcaption className="who"><span className="av">DH</span><span><b>Rev. David H. Hornsby, Ret.</b><small>Flowery Branch, GA</small></span></figcaption>
            </figure>
            <figure className="quote" style={{ margin: 0 }}>
              <div className="chips"><span className="chip">Professionalism</span><span className="chip">Punctuality</span><span className="chip">Quality</span></div>
              <blockquote>“Dan was very attentive and checked the work after each worker. He and Jeanette helped with ideas and paint colors and other things I hadn’t considered.”</blockquote>
              <figcaption className="who"><span className="av">JG</span><span><b>Jeff Geuder</b><small>Bathroom renovation</small></span></figcaption>
            </figure>
          </div>
          <div className="cta-row"><a className="btn btn-ghost" href="#reviews">Read all reviews</a></div>
        </div>
      </div>

      <div className="band">
        <div className="wrap">
          <div className="cta-band">
            <div>
              <h2>What’s your vision?</h2>
              <p>Tell us about your kitchen, bath, lanai or addition. We’ll schedule a free, no-obligation estimate at your home in The Villages or Wildwood.</p>
            </div>
            <div className="cta-row" style={{ margin: 0 }}><a className="btn btn-primary" href="#contact">Start my estimate</a></div>
          </div>
        </div>
      </div>
    </Page>
  );
}
