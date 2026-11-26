import { Page, PageHead } from '../Layout.jsx';
import { content as c, Text, Img, Rich } from '../../content/content.jsx';

const A = c.about;

export default function About({ active }) {
  return (
    <Page name="about" active={active}>
      <PageHead crumb="About">
        <h1><Text path="about.title" />{' '}<Text path="about.titleScript" className="script" /></h1>
      </PageHead>
      <div className="band" style={{ paddingTop: 36 }}>
        <div className="wrap about-grid">
          <div className="ph"><Img path="about.photo" /></div>
          <div>
            <div className="prose">
              {A.paragraphs.map((p, i) => <p key={i}><Rich text={p} /></p>)}
            </div>
            <div className="stats">
              {A.stats.map(s => <div className="stat" key={s.value}><b>{s.value}</b><span>{s.label}</span></div>)}
            </div>
            <div className="principle"><small>{A.principleSource}</small><p>{A.principle}</p></div>
          </div>
        </div>
      </div>
      <div className="band alt">
        <div className="wrap">
          <div className="sec-head"><Text path="about.valuesEyebrow" as="p" className="eyebrow" /><Text path="about.valuesTitle" as="h2" /></div>
          <div className="values">
            {A.values.map(v => <div className="value" key={v.title}><h3>{v.title}</h3><p>{v.text}</p></div>)}
          </div>
        </div>
      </div>
    </Page>
  );
}
