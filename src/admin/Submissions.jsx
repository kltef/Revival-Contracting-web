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
    blurb: 'Sent from the Reviews page. A review shows on the site only after you publish it.',
    empty: 'No reviews yet.',
    heading: r => (
      <>{r.name} <span className="a-stars" aria-label={r.rating + ' stars'}>{stars(r.rating)}</span>
        {r.publishedReviewId && <span className="a-badge">On the site</span>}</>
    ),
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
    actions: (r, { publish, unpublish, busy }) => (r.publishedReviewId
      ? <button type="button" className="a-btn ghost" disabled={busy} onClick={() => unpublish(r)}>Remove from site</button>
      : <button type="button" className="a-btn" disabled={busy || !r.allowPublish} title={r.allowPublish ? undefined : 'The reviewer didn’t give permission to post it'} onClick={() => publish(r)}>Publish</button>),
  },
};

export default function Submissions({ client, kind }) {
  const k = KINDS[kind];
  const model = client.models[k.model];
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  // run a change, then reload so the list matches what's saved
  const run = async (fn, failMsg) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { console.error(e); setError(failMsg + ': ' + e.message); }
    await load();
    setBusy(false);
  };
  const check = ({ data, errors }) => { if (errors?.length) throw new Error(errors.map(x => x.message).join('; ')); return data; };
  const Published = client.models.PublishedReview;

  // Only the reviewer's first name goes on the site, as the review form promises
  const publish = r => run(async () => {
    const shown = check(await Published.create({
      name: r.name.trim().split(/\s+/)[0], location: r.location, project: r.project,
      rating: r.rating, highlights: r.highlights, review: r.review,
    }));
    check(await model.update({ id: r.id, publishedReviewId: shown.id }));
  }, 'Could not publish');

  const unpublish = r => run(async () => {
    check(await Published.delete({ id: r.publishedReviewId }));
    check(await model.update({ id: r.id, publishedReviewId: null }));
  }, 'Could not remove it from the site');

  const del = r => {
    const onSite = r.publishedReviewId ? ' It will also be removed from the site.' : '';
    if (!confirm(`Delete the submission from ${r.name}?${onSite} This can't be undone.`)) return;
    run(async () => {
      if (r.publishedReviewId) check(await Published.delete({ id: r.publishedReviewId }));
      check(await model.delete({ id: r.id }));
    }, 'Could not delete');
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
              <div className="a-actions">
                {k.actions?.(r, { publish, unpublish, busy })}
                <button type="button" className="a-btn danger" disabled={busy} onClick={() => del(r)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
