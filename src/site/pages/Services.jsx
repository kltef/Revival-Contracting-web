import { Page, PageHead } from '../Layout.jsx';
import { orderServices, DEFAULT_COUNTS } from '../../lib/services.mjs';
import { Text, Img, useContent, useEditing, lines } from '../../content/content.jsx';

// The service list (order, text, photos) comes from site.json. Services are ordered by estimate-request counts.
export default function Services({ active, counts = DEFAULT_COUNTS }) {
  const s = useContent().services;
  const editing = useEditing();
  // keep each service's index in site.json so the editor knows which one is being changed
  const services = orderServices(s.list.map((item, at) => ({ ...item, at })), counts);
  return (
    <Page name="services" active={active}>
      <PageHead crumb="Services">
        <h1><Text path="services.title" />{' '}<Text path="services.titleScript" className="script" /></h1>
        <Text path="services.lead" as="p" className="lead" multiline />
      </PageHead>
      <div className="wrap">
        {services.map((svc, i) => {
          const p = ['services', 'list', svc.at];
          return (
            <article key={svc.key} className={'svc' + (i % 2 === 1 ? ' flip' : '')} data-service={svc.key} data-tag={svc.tag}>
              {svc.photo
                ? <div className="ph"><Img path={[...p, 'photo']} /></div>
                : <div className="noimg"><div><Text path={[...p, 'noPhoto', 'title']} className="script" /><Text path={[...p, 'noPhoto', 'text']} as="p" style={{ marginTop: 10, opacity: .8 }} /></div></div>}
              <div>
                {i === 0 ? <Text path="services.mostRequested" as="p" className="eyebrow" /> : <Text path={[...p, 'tag']} as="p" className="eyebrow" />}
                <Text path={[...p, 'title']} as="h2" />
                <Text path={[...p, 'text']} as="p" multiline />
                {/* in the editor the list is one box, one item per line */}
                {editing
                  ? <Text path={[...p, 'items']} as="ul" className="svc-items-edit" multiline />
                  : <ul>{lines(svc.items).map(t => <li key={t}>{t}</li>)}</ul>}
              </div>
            </article>
          );
        })}
      </div>
      <div className="band alt">
        <div className="wrap">
          <div className="sec-head"><Text path="services.faqEyebrow" as="p" className="eyebrow" /><Text path="services.faqTitle" as="h2" /></div>
          <div className="faq">
            {/* the editor opens every answer so it can be clicked */}
            {s.faq.map((_, i) => <details key={i} open={editing ? true : undefined}><Text path={['services', 'faq', i, 'q']} as="summary" /><Text path={['services', 'faq', i, 'a']} as="p" multiline /></details>)}
          </div>
        </div>
      </div>
    </Page>
  );
}
