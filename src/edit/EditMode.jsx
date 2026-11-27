import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import App from '../site/App.jsx';
import { ContentProvider, EditContext, Rich, content as published } from '../content/content.jsx';
import { diffContent, isProtectedPath, pathKey, MAX_TEXT } from '../lib/content-edit.mjs';
import Requests from './Requests.jsx';
import { markStaff } from '../lib/staff.mjs';
import { call, shrink, where, fieldName, TIMING } from './shared.js';
import './edit.css';

// The inline website editor (/?edit): the real site, where clicking words edits them and each photo
// has a "Change photo" button. Nothing changes for visitors until an edit is sent and approved.

const PLAINTEXT = (() => {
  const d = document.createElement('div');
  try { d.contentEditable = 'plaintext-only'; } catch { return false; }
  return d.contentEditable === 'plaintext-only';
})();
const cls = (...c) => c.filter(Boolean).join(' ');
const setIn = (obj, path, value) => {
  const next = structuredClone(obj);
  path.slice(0, -1).reduce((o, k) => o[k], next)[path[path.length - 1]] = value;
  return next;
};
const getIn = (obj, path) => path.reduce((o, k) => o?.[k], obj);
const keyToPath = key => key.split('.').map(s => (/^\d+$/.test(s) ? Number(s) : s));

// Unsent text edits survive a reload or a closed tab (photos have to be chosen again).
const local = {
  get(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
  set(key, v) { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } },
};
const DRAFT = 'revival-editor-draft', WELCOMED = 'revival-editor-welcomed';

const Icon = {
  camera: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  pencil: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>,
  close: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>,
};

// ---------- editable pieces of the page ----------

function EditableText({ path, Tag, value, multiline, rest, ed }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  const cancelled = useRef(false);
  const k = pathKey(path);

  useLayoutEffect(() => {
    if (!editing) return;
    const el = ref.current;
    el.textContent = value;
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    ed.setActive({ path, el, multiline });
    return () => ed.setActive(a => (a?.el === el ? null : a));
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = commit => {
    if (!ref.current) return;
    if (commit && !cancelled.current) {
      let t = ref.current.innerText.replace(/ /g, ' ').replace(/\r/g, '');
      t = multiline ? t.replace(/^\n+|\n+$/g, '') : t.replace(/\s*\n\s*/g, ' ').trim();
      ed.change(path, t.slice(0, MAX_TEXT));
    }
    cancelled.current = false;
    setEditing(false);
  };
  const start = e => { e.preventDefault(); e.stopPropagation(); setEditing(true); };

  if (editing) {
    return (
      <Tag {...rest} key="editing" ref={ref} className={cls(rest.className, 'ed-text', 'ed-editing')}
        contentEditable={PLAINTEXT ? 'plaintext-only' : 'true'} suppressContentEditableWarning spellCheck
        role="textbox" aria-multiline={multiline} aria-label={fieldName(path)}
        onBlur={() => finish(true)}
        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); cancelled.current = true; finish(false); }
          else if (e.key === 'Enter' && !multiline) { e.preventDefault(); ref.current.blur(); }
          else if (e.key === 'Enter' && !PLAINTEXT) { e.preventDefault(); document.execCommand('insertLineBreak'); }
        }}
        onPaste={e => {
          e.preventDefault();
          const t = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, multiline ? t : t.replace(/\s*\n\s*/g, ' '));
        }} />
    );
  }
  return (
    <Tag {...rest} key="view" data-ed={k} tabIndex={0}
      className={cls(rest.className, 'ed-text', ed.changed.has(k) && 'ed-changed', !value && 'ed-empty')}
      title={`Click to change: ${fieldName(path)}`}
      // words on a button (like the before/after tabs) keep working as buttons; double-click edits them
      onClick={e => { if (!e.currentTarget.parentElement?.closest('button')) start(e); }}
      onDoubleClick={start}
      onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) start(e); }}>
      <Rich text={value} />
    </Tag>
  );
}

function EditableImg({ path, props, ed }) {
  const k = pathKey(path);
  const photo = ed.photos[k];
  return (
    <img {...props} src={photo?.url || props.src} data-ed-img={k} data-ed-label={fieldName(path)}
      className={cls(props.className, 'ed-img', (photo || ed.changed.has(k + '.alt')) && 'ed-img-changed')} />
  );
}

// "Change photo" buttons over every photo currently on screen
function PhotoPins({ onPick }) {
  const [pins, setPins] = useState([]);
  useEffect(() => {
    let raf = 0, last = '';
    const measure = () => {
      raf = 0;
      const stacked = new Map(), out = [];
      for (const img of document.querySelectorAll('img[data-ed-img]')) {
        if (!img.offsetParent) continue; // on a page that isn't showing
        const r = img.getBoundingClientRect();
        if (r.width < 60 || r.height < 40 || r.bottom < 60 || r.top > innerHeight - 40) continue;
        const spot = `${Math.round(r.left)},${Math.round(r.top)}`;
        const n = stacked.get(spot) || 0;
        stacked.set(spot, n + 1);
        out.push({ key: img.dataset.edImg, label: img.dataset.edLabel, top: Math.max(8, r.top) + 12 + n * 48, left: Math.max(8, r.left + 12) });
      }
      const sig = JSON.stringify(out);
      if (sig !== last) { last = sig; setPins(out); }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    // after the site switches pages, measure again once the new page has rendered
    const onRoute = () => { setPins([]); last = ''; setTimeout(schedule, 30); };
    schedule();
    addEventListener('scroll', schedule, true);
    addEventListener('resize', schedule);
    addEventListener('hashchange', onRoute);
    document.addEventListener('load', schedule, true); // a photo finished loading
    const id = setInterval(schedule, 300);
    return () => {
      removeEventListener('scroll', schedule, true); removeEventListener('resize', schedule); removeEventListener('hashchange', onRoute);
      document.removeEventListener('load', schedule, true); clearInterval(id); cancelAnimationFrame(raf);
    };
  }, []);
  return pins.map(p => (
    <button key={p.key} type="button" className="ed-pin" style={{ top: p.top, left: p.left }} onClick={() => onPick(p.key)}>
      {Icon.camera}<span>Change {p.label.toLowerCase()}</span>
    </button>
  ));
}

// The small note above the words being edited
function EditTip({ active }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!active) { setPos(null); return; }
    let raf;
    const tick = () => {
      const r = active.el.getBoundingClientRect();
      const above = r.top > 110;
      setPos({ left: Math.min(Math.max(12, r.left), innerWidth - 332), top: above ? r.top - 10 : r.bottom + 10, above });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active]);
  if (!active || !pos) return null;
  const isProtected = isProtectedPath(active.path);
  const isList = active.path[active.path.length - 1] === 'items';
  return (
    <div className={'ed-tip' + (pos.above ? ' above' : ' below')} style={{ left: pos.left, top: pos.top }} role="status">
      <b>{fieldName(active.path)}</b>
      <span>
        {isList ? 'One item per line. ' : ''}
        {active.multiline ? 'Press Enter for a new line. Click anywhere else when you’re done.' : 'Press Enter when you’re done.'} Esc cancels.
      </span>
      {active.el.textContent.includes('**') && <span>Words between ** marks show in bold.</span>}
      {isProtected && <span className="ed-tip-warn">Anthony checks changes to contact details before they go live.</span>}
    </div>
  );
}

function PhotoDialog({ path, image, photo, original, onPhoto, onAlt, onClose }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const [alt, setAlt] = useState(image.alt ?? '');
  const hasAlt = 'alt' in image;
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  const pick = async file => {
    if (!file) return;
    setError(''); setBusy(true);
    try { const blob = await shrink(file); onPhoto({ blob, url: URL.createObjectURL(blob) }); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };
  const done = () => { if (hasAlt && alt !== image.alt) onAlt(alt); onClose(); };
  return (
    <div className="ed-scrim" onMouseDown={e => { if (e.target === e.currentTarget) done(); }}>
      <div className="ed-modal" role="dialog" aria-modal="true" aria-labelledby="ed-photo-title">
        <div className="ed-modal-head">
          <h2 id="ed-photo-title">{where(path)}</h2>
          <button type="button" className="ed-x" aria-label="Close" onClick={done}>{Icon.close}</button>
        </div>
        <div className="ed-modal-photo">
          <img src={photo?.url || image.src} alt="" />
          {photo && <span className="ed-badge">New photo</span>}
        </div>
        <input ref={input} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files[0]); e.target.value = ''; }} />
        <div className="ed-row">
          <button type="button" className="ed-btn primary" disabled={busy} onClick={() => input.current.click()}>
            {Icon.camera}{busy ? 'Getting the photo ready…' : photo ? 'Choose a different photo' : 'Choose a new photo'}
          </button>
          {photo && <button type="button" className="ed-btn quiet" onClick={() => onPhoto(null)}>Keep the old photo</button>}
        </div>
        {error && <p className="ed-error" role="alert">{error}</p>}
        {hasAlt && (
          <label className="ed-field">
            <span>Describe the photo <small>Read aloud to people who can’t see it</small></span>
            <input value={alt} onChange={e => setAlt(e.target.value)} placeholder={original?.alt || 'For example: New walk-in shower with glass door'} maxLength={300} />
          </label>
        )}
        <div className="ed-row end"><button type="button" className="ed-btn dark" onClick={done}>Done</button></div>
      </div>
    </div>
  );
}

// ---------- the editor ----------

export default function EditMode({ client, upload, exitHref = location.pathname, onSignOut }) {
  // the content this version of the site was built from, i.e. what visitors see right now
  const base = published;
  // bring back unsent edits from last time, where that spot hasn't changed since
  const [draft, setDraft] = useState(() => (local.get(DRAFT) || []).reduce(
    (d, c) => (getIn(base, c.path) === c.before ? setIn(d, c.path, c.after) : d), base));
  const [photos, setPhotos] = useState({});     // image path → { blob, url } chosen on this device
  const [active, setActive] = useState(null);   // text being edited
  const [photoKey, setPhotoKey] = useState(null);
  const [panel, setPanel] = useState(null);     // 'review' | 'sent' | 'done'
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState(null);
  const [welcome, setWelcome] = useState(() => !local.get(WELCOMED));

  const changes = useMemo(() => diffContent(base, draft), [base, draft]);
  const photoList = Object.entries(photos);
  const count = changes.length + photoList.length;
  useEffect(() => { local.set(DRAFT, changes.length ? changes : null); }, [changes]);

  useEffect(() => {
    document.documentElement.classList.add('ed-on');
    markStaff();
    return () => document.documentElement.classList.remove('ed-on');
  }, []);
  useEffect(() => {
    if (!photoList.length) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [photoList.length]);

  const changed = useMemo(() => new Set([...changes.map(c => pathKey(c.path)), ...photoList.map(([k]) => k)]), [changes, photoList]);
  const edit = useMemo(() => {
    const ed = {
      changed, photos, setActive,
      change: (path, value) => setDraft(d => setIn(d, path, value)),
    };
    return {
      text: p => <EditableText key={pathKey(p.path)} {...p} ed={ed} />,
      img: p => <EditableImg key={pathKey(p.path)} {...p} ed={ed} />,
    };
  }, [draft, changed, photos]);

  const setPhoto = (key, p) => setPhotos(all => {
    const next = { ...all };
    if (next[key]) URL.revokeObjectURL(next[key].url);
    if (p) next[key] = p; else delete next[key];
    return next;
  });
  const undoAll = () => {
    if (!confirm('Undo all your changes?')) return;
    photoList.forEach(([, p]) => URL.revokeObjectURL(p.url));
    setPhotos({}); setDraft(base);
  };

  const send = async () => {
    setSending(true); setSendError('');
    try {
      const uploads = [];
      for (const [i, [k, p]] of photoList.entries()) {
        const key = `content-uploads/${Date.now()}-${i + 1}.jpg`;
        await upload(key, p.blob);
        uploads.push({ path: [...keyToPath(k), 'src'], key });
      }
      const r = await call(client, 'submit', { changes: changes.map(c => ({ path: c.path, value: c.after })), uploads, note });
      photoList.forEach(([, p]) => URL.revokeObjectURL(p.url));
      setPhotos({}); setNote(''); setDraft(base); local.set(DRAFT, null);
      setSent(r); setPanel('done');
    } catch (e) {
      setSendError('Your changes couldn’t be sent. They’re still here, so you can try again. ' + e.message);
    }
    setSending(false);
  };

  const photoPath = photoKey && keyToPath(photoKey);
  const needsAnthony = changes.some(c => isProtectedPath(c.path));

  return (
    <>
      <ContentProvider value={draft}>
        <EditContext.Provider value={edit}>
          <App />
        </EditContext.Provider>
      </ContentProvider>

      {!panel && !photoKey && <PhotoPins onPick={setPhotoKey} />}
      <EditTip active={active} />

      {welcome && !panel && (
        <div className="ed-welcome" role="note">
          <b>You’re editing your website</b>
          <p><span className="ed-ic">{Icon.pencil}</span><span>Click any words to change them.</span></p>
          <p><span className="ed-ic">{Icon.camera}</span><span>Use <b>Change photo</b> to replace a photo.</span></p>
          <p>Nothing changes for visitors until you press <b>Review & send</b>. {TIMING}</p>
          <button type="button" className="ed-btn dark" onClick={() => { setWelcome(false); local.set(WELCOMED, true); }}>Got it</button>
        </div>
      )}

      <div className="ed-bar" role="toolbar" aria-label="Website editor">
        <span className="ed-bar-label"><i className="ed-dot" />Editing</span>
        <span className="ed-bar-count" aria-live="polite">{count ? `${count} change${count > 1 ? 's' : ''}` : 'No changes yet'}</span>
        {count > 0 && <button type="button" className="ed-btn ghost" onClick={undoAll}>Undo all</button>}
        <button type="button" className="ed-btn light" disabled={!count} onClick={() => setPanel('review')}>Review & send</button>
        <button type="button" className="ed-btn ghost" onClick={() => setPanel('sent')}>Sent changes</button>
        <a className="ed-btn ghost" href={exitHref}>Exit</a>
      </div>

      {photoKey && (
        <PhotoDialog key={photoKey} path={photoPath} image={getIn(draft, photoPath)} original={getIn(base, photoPath)} photo={photos[photoKey]}
          onPhoto={p => setPhoto(photoKey, p)} onAlt={alt => setDraft(d => setIn(d, [...photoPath, 'alt'], alt))} onClose={() => setPhotoKey(null)} />
      )}

      {panel && (
        <div className="ed-scrim" onMouseDown={e => { if (e.target === e.currentTarget && !sending) setPanel(null); }}>
          <aside className="ed-sheet" role="dialog" aria-modal="true" aria-labelledby="ed-sheet-title">
            <div className="ed-sheet-head">
              <h2 id="ed-sheet-title">{panel === 'review' ? 'Review your changes' : panel === 'done' ? 'Sent for review' : 'Sent changes'}</h2>
              <button type="button" className="ed-x" aria-label="Close" disabled={sending} onClick={() => setPanel(null)}>{Icon.close}</button>
            </div>
            <div className="ed-sheet-body">
              {panel === 'review' && (
                <>
                  <p className="ed-muted">Check each change, add a note if you like, then send. {TIMING}</p>
                  <ol className="ed-changes">
                    {changes.map(c => (
                      <li key={pathKey(c.path)}>
                        <div className="ed-change-head"><b>{where(c.path)}</b>
                          <button type="button" className="ed-link" onClick={() => setDraft(d => setIn(d, c.path, c.before))}>Undo</button></div>
                        <div className="ed-was"><small>Was</small><p><Rich text={c.before || '(empty)'} /></p></div>
                        <div className="ed-now"><small>Now</small><p><Rich text={c.after || '(empty)'} /></p></div>
                      </li>
                    ))}
                    {photoList.map(([k, p]) => (
                      <li key={k}>
                        <div className="ed-change-head"><b>{where(keyToPath(k))}</b>
                          <button type="button" className="ed-link" onClick={() => setPhoto(k, null)}>Undo</button></div>
                        <div className="ed-now"><small>New photo</small><img src={p.url} alt="" /></div>
                      </li>
                    ))}
                  </ol>
                  {needsAnthony && <p className="ed-warn">This includes contact details, so Anthony will check it before it goes live.</p>}
                  <label className="ed-field">
                    <span>Note for the reviewer <small>Optional</small></span>
                    <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="For example: We changed our hours for the summer." />
                  </label>
                  {sendError && <p className="ed-error" role="alert">{sendError}</p>}
                </>
              )}
              {panel === 'done' && sent && (
                <div className="ed-done">
                  <span className="ed-done-ic">{Icon.check}</span>
                  <h3>Thank you! Your changes were sent.</h3>
                  <p>{sent.needsPerson ? 'Some of them are things Anthony checks himself, so they can take up to 24 hours.' : TIMING}</p>
                  <p className="ed-muted">The website will show your changes once they’re approved. You can follow along under Sent changes.</p>
                </div>
              )}
              {panel === 'sent' && <Requests client={client} />}
            </div>
            <div className="ed-sheet-foot">
              {panel === 'review' && (
                <>
                  <button type="button" className="ed-btn quiet" disabled={sending} onClick={() => setPanel(null)}>Keep editing</button>
                  <button type="button" className="ed-btn primary" disabled={sending || !count} onClick={send}>{sending ? 'Sending…' : 'Send for review'}</button>
                </>
              )}
              {panel === 'done' && (
                <>
                  <button type="button" className="ed-btn quiet" onClick={() => setPanel('sent')}>See sent changes</button>
                  <button type="button" className="ed-btn primary" onClick={() => setPanel(null)}>Back to the website</button>
                </>
              )}
              {panel === 'sent' && onSignOut && <button type="button" className="ed-btn quiet" onClick={onSignOut}>Sign out</button>}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
