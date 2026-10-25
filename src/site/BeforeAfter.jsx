import { useEffect, useRef, useState } from 'react';

const SETS = {
  kitchen: ['photos/k-before.jpg', 'photos/k-after.jpg', 'Kitchen'],
  bath: ['photos/b-before.jpg', 'photos/b-vanity.jpg', 'Bathroom'],
};
const TABS = [['kitchen', 'Kitchen remodel'], ['bath', 'Bath remodel']];

export default function BeforeAfter() {
  const [tab, setTab] = useState('kitchen');       // selected tab
  const [shown, setShown] = useState('kitchen');   // photos on screen (changes after the fade-out)
  const [swapping, setSwapping] = useState(false);
  const baRef = useRef(null), rangeRef = useRef(null), beforeRef = useRef(null), afterRef = useRef(null);
  const slider = useRef(null);

  // the slider eases toward its target position each frame
  useEffect(() => {
    const ba = baRef.current;
    const tagL = ba.querySelector('.tag.l'), tagR = ba.querySelector('.tag.r');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pos = 50, target = 50, ease = .22, running = false, dragging = false;
    const paint = () => {
      ba.style.setProperty('--pos', pos.toFixed(2) + '%');
      tagL.classList.toggle('off', pos <= 10);  /* before image almost hidden */
      tagR.classList.toggle('off', pos >= 90);  /* after image almost hidden */
    };
    const tick = () => {
      const d = target - pos;
      if (reduce || Math.abs(d) < .05) { pos = target; paint(); running = false; return; }
      pos += d * ease; paint(); requestAnimationFrame(tick);
    };
    const setTarget = (v, e) => { target = v; ease = e || .22; if (!running) { running = true; requestAnimationFrame(tick); } };
    // drag anywhere on the photo (mouse, finger or pen); vertical swipes still scroll the page
    const posFromX = x => { const b = ba.getBoundingClientRect(); return Math.max(0, Math.min(100, (x - b.left) / b.width * 100)); };
    const moveTo = x => { const v = posFromX(x); rangeRef.current.value = Math.round(v); setTarget(v, .35); };
    const down = e => { dragging = true; try { ba.setPointerCapture(e.pointerId); } catch (_) { /* not supported */ } moveTo(e.clientX); };
    const move = e => { if (dragging) moveTo(e.clientX); };
    const up = () => { dragging = false; };
    ba.addEventListener('pointerdown', down);
    ba.addEventListener('pointermove', move);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => ba.addEventListener(t, up));
    paint();
    slider.current = { setTarget, reduce };
    return () => {
      ba.removeEventListener('pointerdown', down);
      ba.removeEventListener('pointermove', move);
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => ba.removeEventListener(t, up));
    };
  }, []);

  // once the new photos are ready, fade them back in
  useEffect(() => {
    if (!swapping) return;
    const show = () => setSwapping(false);
    Promise.all([beforeRef.current, afterRef.current].map(im => im.decode ? im.decode().catch(() => {}) : null)).then(show);
    const t = setTimeout(show, 600);
    return () => clearTimeout(t);
  }, [shown]);

  const choose = key => {
    setTab(key);
    setSwapping(true);
    setTimeout(() => setShown(key), slider.current.reduce ? 0 : 220);
    rangeRef.current.value = 50;
    slider.current.setTarget(50, .09);
  };

  const [before, after, label] = SETS[shown];
  return (
    <>
      <div>
        <p className="eyebrow">Before &amp; after</p>
        <h2 style={{ marginTop: 12 }}>Drag to see the difference</h2>
        <p className="lead" style={{ marginTop: 14 }}>Real Revival projects in The Villages. Slide the handle to compare the original room with the finished remodel.</p>
        <div className="tabs" role="tablist" aria-label="Choose a project">
          {TABS.map(([key, text]) => (
            <button key={key} className="tab" role="tab" aria-selected={tab === key} data-ba={key} onClick={() => choose(key)}>{text}</button>
          ))}
        </div>
      </div>
      <div className={'ba' + (swapping ? ' swapping' : '')} id="ba" ref={baRef} style={{ '--pos': '50%' }}>
        <img className="before" id="baBefore" ref={beforeRef} src={before} alt={label + ' before remodel'} />
        <img className="after" id="baAfter" ref={afterRef} src={after} alt={label + ' after remodel'} />
        <span className="tag l">Before</span><span className="tag r">After</span>
        <div className="handle"><div className="knob"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" /></svg></div></div>
        <input type="range" id="baRange" ref={rangeRef} min="0" max="100" defaultValue="50" aria-label="Compare before and after"
          onInput={e => slider.current.setTarget(+e.target.value, .28)} />
      </div>
    </>
  );
}
