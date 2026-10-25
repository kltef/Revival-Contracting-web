import { Page, PageHead } from '../Layout.jsx';
import { orderServices, DEFAULT_COUNTS } from '../../lib/services.mjs';

const SERVICES = [
  {
    key: 'kitchen', tag: 'Cook & gather', title: 'Custom kitchens',
    photo: ['photos/k-1.jpg', 'Remodeled kitchen'],
    text: 'A remodeled kitchen is one of the best investments you can make in your home. We design around how you cook and gather, then build it with one contractor managing everything from start to finish.',
    items: ['Cabinet design & install', 'Countertops & backsplash', 'Range walls & hoods', 'Kitchen, dining & entry remodels', 'Lighting & electrical', 'Flooring'],
  },
  {
    key: 'bath', tag: 'Comfort & accessibility', title: 'Bathrooms',
    photo: ['photos/b-vanity.jpg', 'Remodeled bathroom vanity'],
    text: 'From a single vanity swap to a full master bath, we remove what isn’t working and build a space that fits how you live now.',
    items: ['Tub-to-shower conversions', 'Walk-in & enclosed showers', 'Double vanities', 'Linen closets & storage', 'Make-up tables', 'Tile & fixtures'],
  },
  {
    key: 'outdoor', tag: 'Outdoor living', title: 'Lanai enclosures & summer kitchens',
    noimg: ['Lanais & summer kitchens', 'Enjoy the Florida weather year round'],
    text: 'Turn an open lanai into a room you use every day, or add an outdoor “summer” kitchen built for entertaining.',
    items: ['Lanai enclosures', 'Outdoor kitchens', 'Covered patios', 'Grill & prep stations'],
  },
  {
    key: 'addition', tag: 'More space', title: 'Home additions',
    noimg: ['Additions', 'Room to grow, designed to match'],
    text: 'Architecturally inspired additions that look like they were always part of your home, managed from plans and permits to finish.',
    items: ['Bedroom & bath additions', 'Expanded living areas', 'Permits & inspections', 'Matching rooflines & finishes'],
  },
];

const FAQ = [
  ['Is the estimate really free?', 'Yes. Every project starts with a free, no-obligation estimate at your home.'],
  ['Where do you work?', 'We currently serve homes in The Villages and Wildwood, Florida.'],
  ['How will I know what’s happening on my project?', 'You get access to our online portal with real-time progress updates, schedules and selections. We also tell you the dates and times each trade is coming.'],
  ['Do you help with design choices?', 'Yes. Dan sits down with you to choose layouts, products, finishes and paint colors.'],
  ['Are you licensed?', 'Yes. Revival is a Florida licensed residential contractor.'],
];

export default function Services({ active, counts = DEFAULT_COUNTS }) {
  const services = orderServices(SERVICES, counts);
  return (
    <Page name="services" active={active}>
      <PageHead crumb="Services">
        <h1>Every room, <span className="script">one contractor.</span></h1>
        <p className="lead">Revival handles all aspects of remodeling, with relentless attention to detail, quality workmanship and efficient, timely execution.</p>
      </PageHead>
      <div className="wrap">
        {services.map((s, i) => (
          <article key={s.key} className={'svc' + (i % 2 === 1 ? ' flip' : '')} data-service={s.key} data-tag={s.tag}>
            {s.photo
              ? <div className="ph"><img src={s.photo[0]} alt={s.photo[1]} /></div>
              : <div className="noimg"><div><span className="script">{s.noimg[0]}</span><p style={{ marginTop: 10, opacity: .8 }}>{s.noimg[1]}</p></div></div>}
            <div>
              <p className="eyebrow">{i === 0 ? 'Most requested' : s.tag}</p>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
              <ul>{s.items.map(t => <li key={t}>{t}</li>)}</ul>
            </div>
          </article>
        ))}
      </div>
      <div className="band alt">
        <div className="wrap">
          <div className="sec-head"><p className="eyebrow">Questions</p><h2>Frequently asked</h2></div>
          <div className="faq">
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </div>
      </div>
    </Page>
  );
}
