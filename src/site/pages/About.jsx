import { Page, PageHead } from '../Layout.jsx';
import { Text, Img, useContent } from '../../content/content.jsx';

export default function About({ active }) {
  const a = useContent().about;
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
              {a.paragraphs.map((_, i) => <Text key={i} path={['about', 'paragraphs', i]} as="p" multiline />)}
            </div>
            <div className="stats">
              {a.stats.map((_, i) => <div className="stat" key={i}><Text path={['about', 'stats', i, 'value']} as="b" /><Text path={['about', 'stats', i, 'label']} /></div>)}
            </div>
            <div className="principle"><Text path="about.principleSource" as="small" /><Text path="about.principle" as="p" multiline /></div>
          </div>
        </div>
      </div>
      <div className="band alt">
        <div className="wrap">
          <div className="sec-head"><Text path="about.valuesEyebrow" as="p" className="eyebrow" /><Text path="about.valuesTitle" as="h2" /></div>
          <div className="values">
            {a.values.map((_, i) => <div className="value" key={i}><Text path={['about', 'values', i, 'title']} as="h3" /><Text path={['about', 'values', i, 'text']} as="p" multiline /></div>)}
          </div>
        </div>
      </div>
    </Page>
  );
}
