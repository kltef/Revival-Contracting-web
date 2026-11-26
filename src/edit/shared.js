// Pieces shared by the inline editor (/?edit) and the admin page's Website tab.
import { describePath } from '../lib/content-edit.mjs';

export const TIMING = 'Most changes are live within 15 minutes. If Anthony needs to look at one, it can take up to 24 hours.';

const PAGES = { home: 'Home page', services: 'Services page', projects: 'Projects page', about: 'About page', contact: 'Contact page', business: 'Contact details' };
const SECTIONS = {
  hero: 'Top of the page', services: 'What we build', beforeAfter: 'Before & after', steps: 'How it works',
  portal: 'Project portal', reviews: 'Reviews', cta: 'Bottom of the page', featured: 'Featured review',
  second: 'Second review', kitchen: 'Kitchens', bath: 'Bathrooms', addition: 'Additions', outdoor: 'Lanais & summer kitchens',
  faq: 'Questions', story: 'Project story', stats: 'Numbers', values: 'How we work', list: 'List',
  paragraphs: 'Paragraph', photos: 'Photo', noPhoto: 'Box instead of a photo', trust: 'Short fact', checks: 'Checklist item',
  chips: 'Highlight', serviceArea: 'Service area',
};
const FIELDS = {
  eyebrow: 'Small heading', title: 'Heading', titleStart: 'Heading', titleScript: 'Heading (handwritten part)',
  lead: 'Introduction', text: 'Text', primaryButton: 'Main button', secondaryButton: 'Second button',
  badgeNumber: 'Badge number', badgeSuffix: 'Badge small text', badgeText: 'Badge text',
  ctaTitle: 'Box heading', ctaText: 'Box text', ctaButton: 'Box button', tabKitchen: 'Kitchen button', tabBath: 'Bathroom button',
  label: 'Name', videoButton: 'Video button', readAll: 'Button', button: 'Button', name: 'Name', place: 'Place or project',
  initials: 'Initials', q: 'Question', a: 'Answer', items: 'List', tag: 'Small heading', mostRequested: 'Most requested label',
  value: 'Number', principle: 'Quote', principleSource: 'Quote source', valuesEyebrow: 'Small heading', valuesTitle: 'Heading',
  storyEyebrow: 'Small heading', storyTitle: 'Heading', storyLead: 'Introduction', faqEyebrow: 'Small heading', faqTitle: 'Heading',
  phone: 'Phone number', email: 'Email address', addressLines: 'Address', footerTagline: 'Footer sentence',
  legal: 'Copyright line', license: 'License line', alt: 'Photo description', before: 'Before photo', after: 'After photo',
  photo: 'Photo', src: 'Photo',
};
const spell = k => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

// "Home page › Top of the page › Introduction"
export function where(path) {
  const parts = [];
  path.forEach((k, i) => {
    if (i === 0) parts.push(PAGES[k] || spell(k));
    else if (typeof k === 'number') parts[parts.length - 1] += ` ${k + 1}`;
    else if (k !== 'src' || i < path.length - 1) parts.push(SECTIONS[k] || FIELDS[k] || spell(k));
  });
  return describePath(parts);
}

// The name of one field, e.g. "Photo description"
export const fieldName = path => {
  const k = path[path.length - 1];
  return typeof k === 'number' ? `${SECTIONS[path[path.length - 2]] || 'Item'} ${k + 1}` : FIELDS[k] || spell(k);
};

export async function call(client, action, payload = {}) {
  const { data, errors } = await client.mutations.contentApi({ action, payload: JSON.stringify(payload) });
  if (errors?.length) throw new Error(errors.map(e => e.message).join('; '));
  return typeof data === 'string' ? JSON.parse(data) : data;
}

// Shrink photos before upload: phones take 5–10 MB pictures; the site needs about 2000px.
export async function shrink(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error('That photo type can’t be used. Please choose a JPEG or PNG photo.'); }
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  for (let q = 0.85; ; q -= 0.1) {
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
    if (blob.size < 2.8 * 1024 * 1024 || q < 0.45) return blob;
  }
}

export const when = iso => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
