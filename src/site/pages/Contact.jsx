import { useState } from 'react';
import { Page, PageHead, DoneIcon } from '../Layout.jsx';
import { hasBackend, publicBackend } from '../../amplify.js';

const TYPES = [['t-kitchen', 'Kitchen', 'Full or partial'], ['t-bath', 'Bathroom', 'Shower, vanity, full'], ['t-lanai', 'Lanai', 'Enclosure'],
  ['t-summer', 'Summer kitchen', 'Outdoor'], ['t-add', 'Addition', 'More space'], ['t-other', 'Other', 'Something else']];
const WHEN = [['w-asap', 'As soon as possible', 'ASAP'], ['w-3', 'In 1–3 months', '1–3 months'], ['w-6', 'In 3–6 months', '3–6 months'], ['w-later', 'Just planning', 'Just planning']];
const EMPTY = { type: '', when: '', details: '', name: '', phone: '', email: '', village: '' };

// Estimate requests are saved for Dan to read in /admin.
function EstimateForm() {
  const [v, setV] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [errs, setErrs] = useState(['', '', '']);
  const [sending, setSending] = useState(false);
  const [doneMsg, setDoneMsg] = useState(null);
  const set = k => e => setV(o => ({ ...o, [k]: e.target.value }));

  const err = (i, msg) => setErrs(o => o.map((x, j) => (j === i ? msg : x)));
  const check = i => {
    let msg = '';
    if (i === 0 && !v.type) msg = 'Choose a project type to continue.';
    if (i === 1 && !v.when) msg = 'Choose when you’d like to start.';
    if (i === 2) {
      if (!v.name.trim()) msg = 'Enter your name.';
      else if (!v.phone.trim() && !v.email.trim()) msg = 'Enter a phone number or email so we can reach you.';
    }
    err(i, msg);
    return !msg;
  };

  const submit = async e => {
    e.preventDefault();
    if (!check(2)) return;
    if (hasBackend) {
      setSending(true);
      try {
        const opt = s => s.trim() || null;
        const { errors } = await (await publicBackend()).client.models.EstimateRequest.create({
          projectType: v.type, timing: v.when, details: opt(v.details), name: v.name.trim(),
          phone: opt(v.phone), email: opt(v.email), village: opt(v.village),
        });
        if (errors?.length) throw new Error(errors.map(x => x.message).join('; '));
      } catch (x) {
        console.error(x);
        setSending(false);
        return err(2, 'Sorry, your request couldn’t be sent. Please try again, or call us at (352) 720-3787.');
      }
      setSending(false);
    }
    setDoneMsg(`Thanks, ${v.name.trim().split(' ')[0]}. Your ${v.type.toLowerCase()} request (${v.when.toLowerCase()}) has been sent. We’ll be in touch soon to schedule your free estimate.`);
  };

  const opts = (name, list) => (
    <div className="opts">
      {list.map(([id, value, label, small]) => (
        <label className="opt" key={id}>
          <input type="radio" name={name} id={id} value={value} checked={v[name] === value} onChange={set(name)} />
          <span>{label}{small && <small>{small}</small>}</span>
        </label>
      ))}
    </div>
  );
  const next = <button type="button" className="btn btn-primary" data-next onClick={() => { if (check(step)) setStep(step + 1); }}>Next</button>;
  const back = <button type="button" className="btn btn-ghost" data-back onClick={() => setStep(step - 1)}>Back</button>;
  const on = i => 'fstep' + (!doneMsg && step === i ? ' on' : '');

  return (
    <form className="form" id="qform" noValidate onSubmit={submit}>
      <div className="prog" aria-hidden="true" hidden={!!doneMsg}>{[0, 1, 2].map(i => <i key={i} className={i <= step ? 'on' : undefined}></i>)}</div>
      <div className={on(0)} data-step="1">
        <h3>What are you planning?</h3>
        {opts('type', TYPES.map(([id, val, small]) => [id, val, val, small]))}
        <p className="err" id="e1">{errs[0]}</p>
        <div className="fnav"><span></span>{next}</div>
      </div>
      <div className={on(1)} data-step="2">
        <h3>When would you like to start?</h3>
        {opts('when', WHEN)}
        <div className="field full"><label className="l" htmlFor="details">Tell us about your vision <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>(optional)</span></label>
          <textarea className="in" id="details" name="details" placeholder="For example: convert the tub to a walk-in shower and add a double vanity" value={v.details} onChange={set('details')} /></div>
        <p className="err" id="e2">{errs[1]}</p>
        <div className="fnav">{back}{next}</div>
      </div>
      <div className={on(2)} data-step="3">
        <h3>How can we reach you?</h3>
        <div className="fields">
          <div className="field"><label className="l" htmlFor="name">Name</label><input className="in" id="name" name="name" autoComplete="name" value={v.name} onChange={set('name')} /></div>
          <div className="field"><label className="l" htmlFor="phone">Phone</label><input className="in" id="phone" name="phone" type="tel" autoComplete="tel" value={v.phone} onChange={set('phone')} /></div>
          <div className="field full"><label className="l" htmlFor="email">Email</label><input className="in" id="email" name="email" type="email" autoComplete="email" value={v.email} onChange={set('email')} /></div>
          <div className="field full"><label className="l" htmlFor="village">Neighborhood or village</label><input className="in" id="village" name="village" placeholder="For example: Village of Fenney" value={v.village} onChange={set('village')} /></div>
        </div>
        <p className="err" id="e3">{errs[2]}</p>
        <div className="fnav">{back}<button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Request my estimate'}</button></div>
      </div>
      <div className={'done' + (doneMsg ? ' on' : '')} id="done">
        <DoneIcon />
        <h3 style={{ fontSize: '1.6rem' }}>Request sent</h3>
        <p className="lead" style={{ margin: '0 auto' }} id="doneMsg">{doneMsg}</p>
        {!hasBackend && <p className="note">This is a sample form and isn’t connected yet, so nothing was sent.</p>}
      </div>
    </form>
  );
}

function CopyButton({ target, children }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const el = document.getElementById(target);
    const txt = el.innerText.replace(/\n/g, ', ');
    const ok = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
    const fallback = () => { const rg = document.createRange(); rg.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(ok, fallback); else fallback();
  };
  return <button className="copy" type="button" data-copy={target} onClick={copy}>{copied ? 'Copied' : children}</button>;
}

export default function Contact({ active }) {
  return (
    <Page name="contact" active={active}>
      <PageHead crumb="Contact">
        <h1>Start with your <span className="script">vision.</span></h1>
        <p className="lead">Tell us a little about your project. It takes about a minute, and we’ll reach out to schedule your free, no-obligation estimate.</p>
      </PageHead>
      <div className="band" style={{ paddingTop: 36 }}>
        <div className="wrap contact-grid">
          <EstimateForm />
          <aside className="info">
            <div className="info-card"><h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>Call us</h3>
              <p id="phoneText"><a href="tel:+13527203787" style={{ textDecoration: 'none', fontWeight: 600, color: 'var(--ink)' }}>(352) 720-3787</a></p><CopyButton target="phoneText">Copy number</CopyButton></div>
            <div className="info-card"><h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>Email</h3>
              <p id="emailText" style={{ overflowWrap: 'anywhere' }}>Dan@Revival-Contracting.com</p><CopyButton target="emailText">Copy email</CopyButton></div>
            <div className="info-card"><h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>Office</h3>
              <p id="addrText">11635 CR 108<br />Oxford, FL 34484</p><CopyButton target="addrText">Copy address</CopyButton></div>
            <div className="info-card"><h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>Service area</h3>
              <div className="area"><span className="chip">The Villages</span><span className="chip">Wildwood</span></div></div>
            <div className="info-card"><h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>Follow along</h3>
              <p><a href="https://instagram.com/revival0815/" target="_blank" rel="noopener">Instagram</a> · <a href="https://facebook.com/Revival-Contracting-Remodeling-2408792489344651/" target="_blank" rel="noopener">Facebook</a></p></div>
          </aside>
        </div>
      </div>
    </Page>
  );
}
