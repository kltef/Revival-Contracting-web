import { createContext, useContext } from 'react';
import site from './site.json';

// Everything editable on the public site lives in site.json. Pages read it through these helpers,
// always by path, so the inline editor (src/edit/, opened with /?edit) can swap in a draft and make
// each piece clickable. Visitors get the plain versions; the editor code never loads for them.

export const content = site;
const ContentContext = createContext(site);
// Set only in the editor: { text(props), img(props) } render the editable versions.
export const EditContext = createContext(null);

export const ContentProvider = ContentContext.Provider;
export const useContent = () => useContext(ContentContext);
export const useEditing = () => useContext(EditContext);

// 'home.steps.list.0.title' or ['home', 'steps', 'list', 0, 'title']
export const toPath = p => (Array.isArray(p) ? p : String(p).split('.').map(k => (/^\d+$/.test(k) ? Number(k) : k)));
export function get(path, from = site) {
  return toPath(path).reduce((o, k) => o?.[k], from);
}

// Newlines become line breaks and **double asterisks** become bold, so simple formatting
// survives in the content file.
export function Rich({ text }) {
  return String(text ?? '').split('\n').flatMap((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g).map((p, j) => (j % 2 ? <strong key={j}>{p}</strong> : p));
    return i ? [<br key={'br' + i} />, ...parts] : parts;
  });
}

// A piece of text from the content. `multiline` lets the editor accept new lines (Enter).
export function Text({ path, as: Tag = 'span', multiline = false, ...rest }) {
  const data = useContent();
  const edit = useEditing();
  const p = toPath(path);
  const value = get(p, data) ?? '';
  if (edit) return edit.text({ path: p, Tag, value, multiline, rest });
  return <Tag {...rest}><Rich text={value} /></Tag>;
}

export function Img({ path, style, ...rest }) {
  const data = useContent();
  const edit = useEditing();
  const p = toPath(path);
  const im = get(p, data) || {};
  const props = { src: im.src, alt: im.alt ?? '', style: { ...(im.position ? { objectPosition: im.position } : {}), ...style }, ...rest };
  if (edit) return edit.img({ path: p, props, image: im });
  return <img {...props} />;
}

// One item per line, for lists typed into a single box
export function lines(text) {
  return String(text ?? '').split('\n').map(s => s.trim()).filter(Boolean);
}

// Phone numbers are shown as typed and dialed from the digits
export function telHref(phone) {
  return 'tel:+1' + String(phone).replace(/\D/g, '').replace(/^1/, '');
}
