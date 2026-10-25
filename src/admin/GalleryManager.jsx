import { useCallback, useEffect, useState } from 'react';
import { getUrl, remove, uploadData } from 'aws-amplify/storage';
import { listAll } from '../amplify.js';
import { DEFAULT_GALLERY, CATEGORIES } from '../lib/gallery.mjs';

// bundled photos live at the site root, one level up from /admin/
const bundled = src => '../' + src;
const fileCaption = name => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();

function CategorySelect({ value, onChange, id }) {
  return (
    <select id={id} value={value || 'kitchen'} onChange={e => onChange(e.target.value)}>
      {CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  );
}

function Uploader({ onUpload, busy }) {
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('kitchen');
  const [inputKey, setInputKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  const pick = list => setFiles([...list].filter(f => f.type.startsWith('image/')));
  const submit = async e => {
    e.preventDefault();
    if (!files.length) return;
    await onUpload(files, caption.trim(), category);
    setFiles([]); setCaption(''); setInputKey(k => k + 1);
  };
  const n = files.length;
  return (
    <form className="a-card a-upload" onSubmit={submit}>
      <h2>Add photos</h2>
      <label className={'a-drop' + (dragging ? ' over' : '') + (n ? ' has' : '')}
        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); }}>
        <input key={inputKey} className="a-sr" type="file" accept="image/*" multiple onChange={e => pick(e.target.files)} />
        <span className="a-drop-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
        </span>
        <span className="a-drop-text">
          <b>{n ? `${n} photo${n > 1 ? 's' : ''} selected` : 'Choose photos'}</b>
          <span className="a-muted">{n ? 'Click to choose different ones' : 'or drag them here'}</span>
        </span>
      </label>
      {n > 0 && <ul className="a-previews">{previews.map((u, i) => <li key={u}><img src={u} alt={files[i]?.name || ''} /></li>)}</ul>}
      <div className="a-row">
        <label>Caption<input value={caption} onChange={e => setCaption(e.target.value)} placeholder={n > 1 ? 'Leave blank to use each file name' : 'For example: Completed kitchen remodel'} /></label>
        <label>Category<CategorySelect value={category} onChange={setCategory} /></label>
        <button className="a-btn" type="submit" disabled={busy || !n}>{busy ? 'Publishing…' : `Publish${n > 1 ? ' ' + n + ' photos' : ''}`}</button>
      </div>
    </form>
  );
}

function PhotoRow({ item, index, count, busy, onMove, onSave, onDelete }) {
  const [caption, setCaption] = useState(item.caption);
  useEffect(() => setCaption(item.caption), [item.caption]);
  const saveCaption = () => { const c = caption.trim(); if (c && c !== item.caption) onSave(item, { caption: c }); else setCaption(item.caption); };
  return (
    <li className="a-photo">
      <span className="a-num">{index + 1}</span>
      <img src={item.url} alt="" />
      <div className="a-photo-fields">
        <input aria-label="Caption" value={caption} onChange={e => setCaption(e.target.value)} onBlur={saveCaption}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <CategorySelect value={item.category} onChange={category => onSave(item, { category })} />
      </div>
      <div className="a-photo-actions">
        <button type="button" className="a-icon" aria-label="Move to top" title="Move to top" disabled={busy || index === 0} onClick={() => onMove(index, 0)}>⤒</button>
        <button type="button" className="a-icon" aria-label="Move up" title="Move up" disabled={busy || index === 0} onClick={() => onMove(index, index - 1)}>↑</button>
        <button type="button" className="a-icon" aria-label="Move down" title="Move down" disabled={busy || index === count - 1} onClick={() => onMove(index, index + 1)}>↓</button>
        <button type="button" className="a-btn danger" disabled={busy} onClick={() => onDelete(item)}>Delete</button>
      </div>
    </li>
  );
}

export default function GalleryManager({ client }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const Photo = client.models.GalleryPhoto;

  const withUrl = async r => ({ ...r, url: r.path ? (await getUrl({ path: r.path })).url.href : bundled(r.src) });

  const load = useCallback(async () => {
    try {
      const rows = (await listAll(Photo)).sort((a, b) => a.sortOrder - b.sortOrder);
      setItems(await Promise.all(rows.map(withUrl)));
    } catch (e) {
      setError('Could not load the gallery: ' + e.message);
      setItems([]);
    }
  }, [Photo]);
  useEffect(() => { load(); }, [load]);

  // run a change, then reload so the list always matches what visitors see
  const run = async (fn, failMsg) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { console.error(e); setError(failMsg + ': ' + e.message); }
    await load();
    setBusy(false);
  };
  const check = ({ errors }) => { if (errors?.length) throw new Error(errors.map(x => x.message).join('; ')); };

  const importDefaults = () => run(async () => {
    for (const [i, g] of DEFAULT_GALLERY.entries()) check(await Photo.create({ ...g, sortOrder: i }));
  }, 'Could not add the built-in photos');

  const upload = (files, caption, category) => run(async () => {
    let order = items.length ? Math.max(...items.map(i => i.sortOrder)) + 1 : 0;
    for (const file of files) {
      const path = `gallery/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '-')}`;
      await uploadData({ path, data: file, options: { contentType: file.type } }).result;
      check(await Photo.create({ path, caption: caption || fileCaption(file.name), category, sortOrder: order++ }));
    }
  }, 'Upload failed');

  const move = (from, to) => {
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setItems(next);
    // save the new position of every photo whose position changed
    run(() => Promise.all(next.map((it, i) => (it.sortOrder === i ? null : Photo.update({ id: it.id, sortOrder: i }).then(check)))),
      'Could not save the new order');
  };

  const save = (item, changes) => run(async () => check(await Photo.update({ id: item.id, ...changes })), 'Could not save');

  const del = item => {
    if (!confirm(`Delete “${item.caption}” from the gallery?`)) return;
    run(async () => {
      check(await Photo.delete({ id: item.id }));
      if (item.path) await remove({ path: item.path });
    }, 'Could not delete');
  };

  return (
    <section>
      <div className="a-head">
        <h1>Gallery</h1>
        <p className="a-muted">Photos show on the Projects page in this order. Changes are saved as you make them.</p>
      </div>
      {error && <p className="a-error" role="alert">{error}</p>}
      <Uploader onUpload={upload} busy={busy} />
      {items === null ? <p className="a-muted">Loading…</p> : items.length === 0 ? (
        <div className="a-card">
          <h2>The site is showing its {DEFAULT_GALLERY.length} built-in photos</h2>
          <p className="a-muted">Add them here to rearrange, re-caption or remove them. Once the gallery has any photos here, the site shows only these, so add the built-in ones first if you want to keep them.</p>
          <button type="button" className="a-btn" disabled={busy} onClick={importDefaults}>Add the built-in photos</button>
        </div>
      ) : (
        <ol className="a-photos" aria-busy={busy}>
          {items.map((item, i) => (
            <PhotoRow key={item.id} item={item} index={i} count={items.length} busy={busy} onMove={move} onSave={save} onDelete={del} />
          ))}
        </ol>
      )}
    </section>
  );
}
