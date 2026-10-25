import { Page, PageHead } from '../Layout.jsx';

const VALUES = [
  ['Integrity', 'Straight answers, honest pricing and promises we keep.'],
  ['Workmanship', 'Doing things right the first time, with every trade checked.'],
  ['Timeliness', 'Modern scheduling so you always know who’s coming and when.'],
  ['Respect', 'Courteous, professional crews who treat your home like their own.'],
];

export default function About({ active }) {
  return (
    <Page name="about" active={active}>
      <PageHead crumb="About">
        <h1>Three generations of <span className="script">doing it right.</span></h1>
      </PageHead>
      <div className="band" style={{ paddingTop: 36 }}>
        <div className="wrap about-grid">
          <div className="ph"><img src="photos/about-house3.jpg" alt="Florida home with a paver driveway and patio with umbrella" style={{ objectPosition: '55% center' }} /></div>
          <div>
            <div className="prose">
              <p><strong>Revival Contracting &amp; Remodeling is a third-generation residential contractor</strong> built on experience, integrity, honesty and quality workmanship. We were founded on Christian principles.</p>
              <p>Owner <strong>Dan Ekberg</strong> has owned and operated his own contracting companies since 1986. He is known in the Central Florida construction industry for his knowledge of the trade and the integrity he brings to every job site.</p>
              <p>We run as a multi-disciplined, fast-paced residential contractor that treats quality and timeliness as essential. Dan helps clients with design ideas and selections. He supervises the work and ensures that everything has been done professionally and properly.</p>
            </div>
            <div className="stats">
              <div className="stat"><b>1986</b><span>Dan’s first contracting company</span></div>
              <div className="stat"><b>3rd</b><span>generation of builders</span></div>
              <div className="stat"><b>1</b><span>contractor managing every trade</span></div>
            </div>
            <div className="principle"><small>From our employee handbook</small><p>“In the end, no matter the cost, always do the right thing by the customer.”</p></div>
          </div>
        </div>
      </div>
      <div className="band alt">
        <div className="wrap">
          <div className="sec-head"><p className="eyebrow">What we stand for</p><h2>How we work</h2></div>
          <div className="values">
            {VALUES.map(([h, p]) => <div className="value" key={h}><h3>{h}</h3><p>{p}</p></div>)}
          </div>
        </div>
      </div>
    </Page>
  );
}
