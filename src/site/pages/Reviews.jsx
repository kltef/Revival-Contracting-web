import { useEffect, useRef, useState } from 'react';
import { Page, PageHead, DoneIcon } from '../Layout.jsx';
import { hasBackend, listAll, publicBackend } from '../../amplify.js';

function Quote({ id, chips, marks, text, initials, name, place }) {
  const [open, setOpen] = useState(false);          // button state
  const [unmasked, setUnmasked] = useState(false);  // text fully shown; collapses a frame later so it animates
  const bq = useRef(null);
  const toggle = () => {
    const el = bq.current;
    el.style.maxHeight = el.scrollHeight + 'px';
    setOpen(!open);
    if (!open) setUnmasked(true);
    else requestAnimationFrame(() => { el.style.maxHeight = ''; setUnmasked(false); });
  };
  return (
    <figure className={'quote' + (unmasked ? ' open' : '')} style={{ margin: 0 }}>
      {chips && <div className="chips">{chips.map(c => <span className="chip" key={c}>{c}</span>)}</div>}
      {marks && <div className="marks">“</div>}
      <blockquote id={id} ref={bq}>{text}</blockquote>
      <button type="button" className="more" aria-expanded={open} aria-controls={id} onClick={toggle}>
        <span>{open ? 'Show less' : 'Read full review'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <figcaption className="who"><span className="av">{initials}</span><span><b>{name}</b><small>{place}</small></span></figcaption>
    </figure>
  );
}

// Reviews published from /admin, newest first
function usePublishedReviews() {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!hasBackend) return;
    let live = true;
    (async () => {
      try {
        const { client } = await publicBackend();
        const rows = await listAll(client.models.PublishedReview);
        if (live) setList(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } catch (e) {
        console.error('Could not load reviews', e);
      }
    })();
    return () => { live = false; };
  }, []);
  return list;
}

const STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z';
const STAR_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
const PROJECT_OPTIONS = ['Kitchen remodel', 'Bathroom remodel', 'Lanai or summer kitchen', 'Addition', 'Other'];
const HIGHLIGHTS = ['Professionalism', 'Punctuality', 'Quality', 'Responsiveness', 'Value'];
// Shortcut keys for #write-review-<key> and ?project=<key>
const PROJECTS = { kitchen: 'Kitchen remodel', bath: 'Bathroom remodel', bathroom: 'Bathroom remodel', lanai: 'Lanai or summer kitchen', outdoor: 'Lanai or summer kitchen', summer: 'Lanai or summer kitchen', addition: 'Addition', other: 'Other' };
const EMPTY = { rating: 0, rvName: '', rvWhere: '', rvProject: '', hl: [], rvText: '', rvEmail: '', rvOk: false };

// Reviews are saved for Dan to read in /admin before anything is added to the site.
function ReviewForm({ open, setOpen, prefill }) {
  const [v, setV] = useState(EMPTY);
  const [hover, setHover] = useState(0);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const [doneMsg, setDoneMsg] = useState(null);
  const formRef = useRef(null);
  const set = (k, val) => setV(o => ({ ...o, [k]: val }));

  // Shortcut link: #write-review opens the review form (good for a QR code).
  // Optional pre-fill through the address, for example:
  //   https://www.revival-contracting.com/?name=Jane%20Smith&where=Village%20of%20Fenney&project=bath&rating=5&email=jane@example.com#write-review
  // The project can also go in the shortcut itself: #write-review-kitchen, -bath, -lanai, -addition, -other
  useEffect(() => {
    if (!prefill) return;
    let q; try { q = new URLSearchParams(location.search); } catch (_) { q = new URLSearchParams(); }
    setV(o => {
      const n = { ...o };
      const fill = (k, val) => { if (val && !n[k].trim()) n[k] = val; };
      fill('rvName', q.get('name')); fill('rvWhere', q.get('where') || q.get('village') || q.get('city'));
      fill('rvEmail', q.get('email')); fill('rvText', q.get('review'));
      const p = (q.get('project') || prefill.project || '').toLowerCase().trim();
      if (p && !n.rvProject) n.rvProject = PROJECTS[p] || PROJECT_OPTIONS.find(x => x.toLowerCase().includes(p)) || '';
      const r = parseInt(q.get('rating'), 10);
      if (r >= 1 && r <= 5 && !n.rating) n.rating = r;
      return n;
    });
  }, [prefill]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      try { document.getElementById('r5').focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    }, 120);
    return () => clearTimeout(t);
  }, [open]);

  const submit = async e => {
    e.preventDefault();
    setErr('');
    const name = v.rvName.trim(), text = v.rvText.trim();
    if (!v.rating) return setErr('Choose a star rating.');
    if (!name) return setErr('Enter your name.');
    if (!v.rvProject) return setErr('Choose which project you had done.');
    if (text.length < 20) return setErr('Write a few more words about your experience.');
    if (!v.rvOk) return setErr('Check the box to allow us to post your review.');
    if (hasBackend) {
      setSending(true);
      try {
        const { errors } = await (await publicBackend()).client.models.ReviewSubmission.create({
          rating: v.rating, name, location: v.rvWhere.trim() || null, project: v.rvProject, highlights: v.hl,
          review: text, email: v.rvEmail.trim() || null, allowPublish: v.rvOk,
        });
        if (errors?.length) throw new Error(errors.map(x => x.message).join('; '));
      } catch (x) {
        console.error(x);
        setSending(false);
        return setErr('Sorry, your review couldn’t be sent. Please try again, or call us at (352) 720-3787.');
      }
      setSending(false);
    }
    setDoneMsg(`Thanks, ${name.split(' ')[0]}. Your ${v.rating}-star review has been sent to Dan for approval.`);
    formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const lit = hover || v.rating;
  return (
    <div className={'rv-wrap' + (open ? ' open' : '')} id="reviewWrap" inert={!open}>
      <div className="rv-inner">
        <form className="form rv-form" id="reviewForm" ref={formRef} noValidate onSubmit={submit}>
          <div className="rv-body" id="rvBody" hidden={!!doneMsg}>
            <div><h3 style={{ fontSize: '1.6rem' }}>Write a review</h3><p className="note" style={{ marginTop: 6 }}>Reviews are sent to Dan for approval before they appear on the site.</p></div>
            <fieldset className="fs"><legend className="l">Your rating</legend>
              <div className="stars" id="stars">
                {[1, 2, 3, 4, 5].map(n => (
                  <label key={n} className={'star' + (n <= lit ? ' on' : '')} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}>
                    <input type="radio" name="rating" id={'r' + n} value={n} aria-label={n + (n === 1 ? ' star' : ' stars')}
                      checked={v.rating === n} onChange={() => set('rating', n)} />
                    <svg viewBox="0 0 24 24"><path d={STAR} /></svg>
                  </label>
                ))}
                <span className="star-txt" id="starTxt">{lit ? STAR_WORDS[lit] : 'Tap to rate'}</span>
              </div>
            </fieldset>
            <div className="fields">
              <div className="field"><label className="l" htmlFor="rvName">Your name</label><input className="in" id="rvName" name="rvName" autoComplete="name" value={v.rvName} onChange={e => set('rvName', e.target.value)} /></div>
              <div className="field"><label className="l" htmlFor="rvWhere">Village or city <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>(optional)</span></label><input className="in" id="rvWhere" name="rvWhere" placeholder="For example: Village of Fenney" value={v.rvWhere} onChange={e => set('rvWhere', e.target.value)} /></div>
              <div className="field full"><label className="l" htmlFor="rvProject">Project</label>
                <select className="in" id="rvProject" name="rvProject" value={v.rvProject} onChange={e => set('rvProject', e.target.value)}>
                  <option value="">Choose your project</option>
                  {PROJECT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select></div>
            </div>
            <fieldset className="fs"><legend className="l">What stood out? <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>(optional)</span></legend>
              <div className="chk-row">
                {HIGHLIGHTS.map((h, i) => (
                  <label className="chk" key={h}>
                    <input type="checkbox" name="hl" id={'hl' + (i + 1)} value={h} checked={v.hl.includes(h)}
                      onChange={e => set('hl', e.target.checked ? [...v.hl, h] : v.hl.filter(x => x !== h))} />
                    <span>{h}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="field"><label className="l" htmlFor="rvText">Your review</label><textarea className="in" id="rvText" name="rvText" placeholder="Tell your neighbors about your project and how it went" value={v.rvText} onChange={e => set('rvText', e.target.value)} /></div>
            <div className="field"><label className="l" htmlFor="rvEmail">Email <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>(optional, never published)</span></label><input className="in" id="rvEmail" name="rvEmail" type="email" autoComplete="email" value={v.rvEmail} onChange={e => set('rvEmail', e.target.value)} /></div>
            <label className="agree"><input type="checkbox" id="rvOk" name="rvOk" checked={v.rvOk} onChange={e => set('rvOk', e.target.checked)} /><span>Revival may post my review, first name and village on its website.</span></label>
            <p className="err" id="rvErr">{err}</p>
            <div className="fnav" style={{ margin: 0 }}>
              <button type="button" className="btn btn-ghost" id="rvCancel" onClick={() => { setOpen(false); document.getElementById('writeReview').scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send review'}</button>
            </div>
          </div>
          <div className={'done' + (doneMsg ? ' on' : '')} id="rvDone">
            <DoneIcon />
            <h3 style={{ fontSize: '1.6rem' }}>Thank you!</h3>
            <p className="lead" style={{ margin: '0 auto' }} id="rvDoneMsg">{doneMsg}</p>
            {!hasBackend && <p className="note">This is a sample form and isn’t connected yet, so nothing was sent.</p>}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Reviews({ active, reviewRequest }) {
  const [open, setOpen] = useState(false);
  const published = usePublishedReviews();
  useEffect(() => { if (reviewRequest) setOpen(true); }, [reviewRequest]);

  return (
    <Page name="reviews" active={active}>
      <PageHead crumb="Reviews">
        <h1>In their <span className="script">words.</span></h1>
        <p className="lead">Most of our work comes from referrals by friends and neighbors.</p>
      </PageHead>
      <div className="band" style={{ paddingTop: 36 }}>
        <div className="wrap" style={{ display: 'grid', gap: 18 }}>
          {published.map(r => {
            const chips = r.highlights?.filter(Boolean);
            return (
              <Quote key={r.id} id={'rv-' + r.id} chips={chips?.length ? chips : null} marks={!chips?.length}
                text={chips?.length ? `“${r.review}”` : r.review} initials={r.name.charAt(0).toUpperCase()} name={r.name}
                place={[r.location, r.project].filter(Boolean).join(' · ')} />
            );
          })}
          <Quote id="rv0" chips={['Professionalism', 'Punctuality', 'Quality', 'Responsiveness', 'Value']} initials="JG" name="Jeff Geuder" place="Bathroom renovation"
            text="“We used RCR for our bathroom renovations. They were recommended by some friends. They sat down with us and helped us chose all of what we needed. The work and products were high quality. Every subcontractor was courteous and professional. We were always made aware of dates and times they were coming. Dan was very attentive and checked the work after each worker. He and Jeanette helped with ideas and paint colors and other things I hadn’t considered. We will definitely be calling them again for our next renovation project.”" />
          <Quote id="rv1" marks initials="DH" name="Rev. David H. Hornsby, Ret." place="Flowery Branch, GA"
            text="I have known Dan Ekberg and his entire family for over 30 years. Dan has owned and operated his own contracting companies since 1986. Dan is “old school” when it comes to his trade; he insists on quality of workmanship and doing things right the first time. It is not coincidental that he is well known throughout the Central Florida construction industry for his superior industry knowledge, as well as for the professionalism and absolute integrity he and his company brings to the job-site. Above all else, Dan is a “Class A” human being. I can unequivocally say that Dan is the epitome of integrity, consideration, honesty and professionalism." />
          <div className="cta-band" style={{ marginTop: 20 }}>
            <div><h2>Worked with us?</h2><p>We’d be grateful if you shared your experience. Reviews help your neighbors find a contractor they can trust.</p></div>
            <div className="cta-row" style={{ margin: 0 }}>
              <button type="button" className="btn btn-primary" id="writeReview" aria-expanded={open} aria-controls="reviewWrap" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Share a review'}</button>
            </div>
          </div>
          <ReviewForm open={open} setOpen={setOpen} prefill={reviewRequest} />
        </div>
      </div>
    </Page>
  );
}
