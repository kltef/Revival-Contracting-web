import { Page, PageHead } from '../Layout.jsx';
import { orderServices, DEFAULT_COUNTS } from '../../lib/services.mjs';
import { content as c, Text, Rich, lines } from '../../content/content.jsx';

const S = c.services;

// The service list (order, text, photos) comes from site.json. Services are ordered by estimate-request counts.
export default function Services({ active, counts = DEFAULT_COUNTS }) {
  const services = orderServices(S.list, counts);
  return (
    <Page name="services" active={active}>
      <PageHead crumb="Services">
        <h1>{S.title}{' '}<span className="script">{S.titleScript}</span></h1>
        <Text path="services.lead" as="p" className="lead" />
      </PageHead>
      <div className="wrap">
        {services.map((s, i) => (
          <article key={s.key} className={'svc' + (i % 2 === 1 ? ' flip' : '')} data-service={s.key} data-tag={s.tag}>
            {s.photo
              ? <div className="ph"><img src={s.photo.src} alt={s.photo.alt} /></div>
              : <div className="noimg"><div><span className="script">{s.noPhoto.title}</span><p style={{ marginTop: 10, opacity: .8 }}>{s.noPhoto.text}</p></div></div>}
            <div>
              <p className="eyebrow">{i === 0 ? S.mostRequested : s.tag}</p>
              <h2>{s.title}</h2>
              <p><Rich text={s.text} /></p>
              <ul>{lines(s.items).map(t => <li key={t}>{t}</li>)}</ul>
            </div>
          </article>
        ))}
      </div>
      <div className="band alt">
        <div className="wrap">
          <div className="sec-head"><Text path="services.faqEyebrow" as="p" className="eyebrow" /><Text path="services.faqTitle" as="h2" /></div>
          <div className="faq">
            {S.faq.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
        </div>
      </div>
    </Page>
  );
}
