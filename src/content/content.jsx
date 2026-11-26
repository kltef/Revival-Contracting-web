import site from './site.json';

// Everything editable on the public site lives in site.json. Pages read it through these helpers,
// so the text and photos can later be overridden without touching the page code.

export const content = site;

export function get(path) {
  return path.split('.').reduce((o, k) => o?.[k], site);
}

// Newlines become line breaks and **double asterisks** become bold, so simple formatting
// survives in the content file.
export function Rich({ text }) {
  return String(text ?? '').split('\n').flatMap((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g).map((p, j) => (j % 2 ? <strong key={j}>{p}</strong> : p));
    return i ? [<br key={'br' + i} />, ...parts] : parts;
  });
}

export function Text({ path, as: Tag = 'span', ...rest }) {
  return <Tag {...rest}><Rich text={get(path)} /></Tag>;
}

// One item per line, for lists typed into a single box
export function lines(text) {
  return String(text ?? '').split('\n').map(s => s.trim()).filter(Boolean);
}

export function Img({ path, style, ...rest }) {
  const im = get(path);
  const pos = im.position ? { objectPosition: im.position } : {};
  return <img src={im.src} alt={im.alt ?? ''} style={{ ...pos, ...style }} {...rest} />;
}

// Phone numbers are shown as typed and dialed from the digits
export function telHref(phone) {
  return 'tel:+1' + String(phone).replace(/\D/g, '').replace(/^1/, '');
}
