import { useEffect, useRef, useState } from 'react';
import { Page, PageHead } from '../Layout.jsx';
import { hasBackend, listAll, publicBackend } from '../../amplify.js';
import { DEFAULT_GALLERY, CATEGORIES, categoryTag } from '../../lib/gallery.mjs';

// Photos and their order are managed from /admin. Until any are saved there, the built-in set is shown.
function useGallery() {
  const [items, setItems] = useState(hasBackend ? null : DEFAULT_GALLERY);
  useEffect(() => {
    if (!hasBackend) return;
    let live = true;
    (async () => {
      let photos = DEFAULT_GALLERY;
      try {
        const { client, getUrl } = await publicBackend();
        const rows = (await listAll(client.models.GalleryPhoto)).sort((a, b) => a.sortOrder - b.sortOrder);
        if (rows.length) {
          photos = (await Promise.all(rows.map(async r => {
            if (!r.path) return { ...r, url: r.src };
            try { return { ...r, url: (await getUrl({ path: r.path, options: { expiresIn: 3600 } })).url.href }; }
            catch (e) { console.error(e); return null; }
          }))).filter(Boolean);
        }
      } catch (e) {
        console.error('Could not load the gallery', e);
      }
      if (live) setItems(photos);
    })();
    return () => { live = false; };
  }, []);
  return items;
}

const STORY = [
  ['Before', [['photos/b-before.jpg', 'Bathroom before'], ['photos/b-tub-before.jpg', 'Bathtub before']]],
  ['Demolition', [['photos/b-demo1.jpg', 'Vanity and tub demo'], ['photos/b-demo2.jpg', 'Shower demo']]],
  ['Finished', [['photos/b-vanity.jpg', 'Double vanity and linen closet'], ['photos/b-shower.jpg', 'Toilet next to new enclosed shower'], ['photos/b-window.jpg', 'Window area with make-up table']]],
];

export default function Projects({ active }) {
  const items = useGallery();
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const lbRef = useRef(null);
  const cats = CATEGORIES.filter(([key]) => items?.some(g => g.category === key));

  const show = g => {
    setOpen(g);
    const lb = lbRef.current;
    try { lb.showModal(); } catch (_) { lb.setAttribute('open', ''); }
  };

  return (
    <Page name="projects" active={active}>
      <PageHead crumb="Projects">
        <h1>Our <span className="script">work.</span></h1>
        <p className="lead">Projects we’ve completed in The Villages. Tap any photo to see it larger.</p>
      </PageHead>
      <div className="band" style={{ paddingTop: 36 }}>
        <div className="wrap">
          <div className="filters" role="tablist" aria-label="Filter projects">
            {[['all', 'All'], ...cats].map(([key, label]) => (
              <button key={key} className="tab" role="tab" aria-selected={filter === key} data-f={key} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
          <div className="grid-g" id="gallery" aria-busy={!items}>
            {(items || []).map((g, i) => (
              <button key={g.id || g.src} className="gi" type="button" data-cat={g.category} data-i={i}
                hidden={!(filter === 'all' || g.category === filter)} onClick={() => show(g)}>
                <img loading="lazy" src={g.url || g.src} alt={g.caption} />
                <figcaption><span>{g.caption}</span><em>{categoryTag(g.category)}</em></figcaption>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="band alt">
        <div className="wrap">
          <div className="sec-head"><p className="eyebrow">Project story</p><h2>Master bathroom remodel</h2><p className="lead">A dated bath with a separate tub became a double vanity, a linen closet, a make-up table and a new enclosed shower.</p></div>
          <div className="story">
            {STORY.map(([title, photos], i) => (
              <div className="col" key={title}>
                <h3><span>{i + 1}</span>{title}</h3>
                {photos.map(([src, alt]) => <div className="ph" key={src}><img src={src} alt={alt} /></div>)}
              </div>
            ))}
          </div>
        </div>
      </div>
      <dialog className="lb" id="lb" ref={lbRef} onClick={e => { if (e.target === lbRef.current) lbRef.current.close(); }}>
        <button type="button" id="lbClose" aria-label="Close" onClick={() => lbRef.current.close()}>×</button>
        <img id="lbImg" src={open ? (open.url || open.src) : undefined} alt={open ? open.caption : ''} />
        <p id="lbCap">{open?.caption}</p>
      </dialog>
    </Page>
  );
}
