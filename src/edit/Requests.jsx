import { useCallback, useEffect, useState } from 'react';
import { call, when, TIMING } from './shared.js';
import './requests.css';

// "Sent changes": each request's progress and its messages with Claude and Anthony.
// Used in the inline editor's side panel and on the admin page. Styles: .rq-* in edit.css / admin.css.

const STEPS = [['checking', 'Automatic check'], ['human', 'Anthony’s review'], ['publishing', 'Going live'], ['live', 'Live']];
const NEXT = {
  checking: 'Most changes are live within 15 minutes.',
  human: 'Anthony will look at it within 24 hours.',
  publishing: 'It will be on the website in a few minutes.',
};

function Progress({ status, held }) {
  if (status === 'closed') return <p className="rq-status">Not published. Anthony closed this request.</p>;
  const steps = STEPS.filter(([k]) => k !== 'human' || held || status === 'human');
  const at = steps.findIndex(([k]) => k === status);
  return (
    <ol className="rq-steps" aria-label="Progress">
      {steps.map(([k, label], i) => (
        <li key={k} className={i < at || status === 'live' ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>{label}</li>
      ))}
    </ol>
  );
}

function Thread({ client, id, onBack }) {
  const [t, setT] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const load = useCallback(() => call(client, 'thread', { id }).then(setT, e => setError(e.message)), [client, id]);
  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const send = async e => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true); setError('');
    try { await call(client, 'message', { id, text }); setText(''); await load(); }
    catch (x) { setError('Your message couldn’t be sent. Please try again. ' + x.message); }
    setSending(false);
  };

  return (
    <div className="rq-thread">
      <button type="button" className="rq-link" onClick={onBack}>← All sent changes</button>
      {!t ? <p className="rq-muted">{error || 'Loading…'}</p> : (
        <>
          <h3>{t.title}</h3>
          <p className="rq-muted">Sent {when(t.createdAt)}</p>
          <Progress status={t.status} held={t.held} />
          <p className="rq-status">{t.statusText}. {NEXT[t.status] || ''}</p>
          <h4>Messages</h4>
          {t.messages.length === 0 && <p className="rq-muted">No messages yet.</p>}
          <ul className="rq-messages">
            {t.messages.map((m, i) => (
              <li key={i} className={'rq-msg ' + m.from}>
                <b>{m.from === 'editor' ? 'You' : m.name}</b> <small>{when(m.at)}</small>
                <p>{m.text}</p>
              </li>
            ))}
          </ul>
          {error && <p className="rq-error" role="alert">{error}</p>}
          <form onSubmit={send} className="rq-compose">
            <label htmlFor="rq-msg">Write a message about this change</label>
            <textarea id="rq-msg" rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="For example: Could you make the heading bigger?" />
            <button className="rq-btn" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send message'}</button>
            <span className="rq-muted">Claude usually answers within a few minutes. Anthony answers within a day.</span>
          </form>
        </>
      )}
    </div>
  );
}

export default function Requests({ client, open: openInitial = null }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(openInitial);
  const load = useCallback(() => call(client, 'list').then(r => { setList(r.requests); setError(''); }, e => setError(e.message)), [client]);
  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);
  useEffect(() => setOpen(openInitial), [openInitial]);

  if (open) return <Thread client={client} id={open} onBack={() => { setOpen(null); load(); }} />;
  return (
    <div className="rq">
      <p className="rq-muted">{TIMING}</p>
      {error && <p className="rq-error" role="alert">{error}</p>}
      {list === null ? <p className="rq-muted">Loading…</p> : list.length === 0 ? <p className="rq-muted">You haven’t sent any changes yet.</p> : (
        <ul className="rq-list">
          {list.map(r => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(r.id)}>
                <span><b>{r.title}</b><small>Sent {when(r.createdAt)}</small></span>
                <span className={'rq-chip ' + r.status}>{r.statusText}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="rq-link" onClick={load}>Refresh</button>
    </div>
  );
}
