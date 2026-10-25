import { useCallback, useEffect, useState } from 'react';
import { listAll } from '../amplify.js';

const when = iso => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

function Field({ label, children }) {
  if (children === null || children === undefined || children === '' || (Array.isArray(children) && !children.length)) return null;
  return <div className="a-field"><dt>{label}</dt><dd>{children}</dd></div>;
}

function Contact({ email, phone }) {
  return (
    <>
      <Field label="Phone">{phone && <a href={'tel:' + phone.replace(/[^\d+]/g, '')}>{phone}</a>}</Field>
      <Field label="Email">{email && <a href={'mailto:' + email}>{email}</a>}</Field>
    </>
  );
}

const KINDS = {
  estimates: {
    model: 'EstimateRequest',
    title: 'Estimate requests',
    blurb: 'Sent from the Contact page.',
    empty: 'No estimate requests yet.',
    heading: r => `${r.name}: ${r.projectType}`,
    body: r => (
      <>
        <Field label="Start">{r.timing}</Field>
        <Contact email={r.email} phone={r.phone} />
        <Field label="Village">{r.village}</Field>
        <Field label="Vision">{r.details}</Field>
      </>
    ),
  },
  reviews: {
    model: 'ReviewSubmission',
    title: 'Reviews',
    blurb: 'Sent from the Reviews page. Nothing here appears on the site until you add it.',
    empty: 'No reviews yet.',
    heading: r => <>{r.name} <span className="a-stars" aria-label={r.rating + ' stars'}>{stars(r.rating)}</span></>,
    body: r => (
      <>
        <Field label="Project">{r.project}</Field>
        <Field label="Village">{r.location}</Field>
        <Field label="Stood out">{r.highlights?.filter(Boolean).join(', ')}</Field>
        <Field label="Review"><span className="a-pre">{r.review}</span></Field>
        <Contact email={r.email} />
        <Field label="May post">{r.allowPublish ? 'Yes' : 'No'}</Field>
      </>
    ),
  },
};

export default function Submissions({ client, kind }) {
  const k = KINDS[kind];
  const model = client.models[k.model];
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const all = await listAll(model);
      setRows(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (e) {
      setError('Could not load: ' + e.message);
      setRows([]);
    }
  }, [model]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const del = async r => {
    if (!confirm(`Delete the submission from ${r.name}? This can't be undone.`)) return;
    const { errors } = await model.delete({ id: r.id });
    if (errors?.length) setError('Could not delete: ' + errors.map(x => x.message).join('; '));
    load();
  };

  return (
    <section>
      <div className="a-head">
        <h1>{k.title}{rows?.length ? <span className="a-count">{rows.length}</span> : null}</h1>
        <p className="a-muted">{k.blurb} Newest first.</p>
        <button type="button" className="a-btn ghost" onClick={load}>Refresh</button>
      </div>
      {error && <p className="a-error" role="alert">{error}</p>}
      {rows === null ? <p className="a-muted">Loading…</p> : rows.length === 0 ? <p className="a-muted">{k.empty}</p> : (
        <ul className="a-list">
          {rows.map(r => (
            <li key={r.id} className="a-card">
              <div className="a-card-top">
                <h2>{k.heading(r)}</h2>
                <time className="a-muted" dateTime={r.createdAt}>{when(r.createdAt)}</time>
              </div>
              <dl>{k.body(r)}</dl>
              <button type="button" className="a-btn danger" onClick={() => del(r)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
