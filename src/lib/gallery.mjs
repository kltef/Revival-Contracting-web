// Built-in gallery, shown until photos are managed from /admin
export const DEFAULT_GALLERY = [
  { src: 'photos/k-after.jpg', category: 'kitchen', caption: 'Kitchen, dining room and entry remodel' },
  { src: 'photos/b-vanity.jpg', category: 'bath', caption: 'Double vanity and linen closet' },
  { src: 'photos/k-1.jpg', category: 'kitchen', caption: 'Completed kitchen remodel' },
  { src: 'photos/k-4.jpg', category: 'kitchen', caption: 'Kitchen, dining room and entry remodel' },
  { src: 'photos/b-window.jpg', category: 'bath', caption: 'Window area with make-up table' },
  { src: 'photos/k-2.jpg', category: 'kitchen', caption: 'Completed kitchen remodel' },
  { src: 'photos/k-6.jpg', category: 'kitchen', caption: 'New flooring through the entry' },
  { src: 'photos/b-shower.jpg', category: 'bath', caption: 'Toilet next to new enclosed shower' },
  { src: 'photos/k-range.jpg', category: 'kitchen', caption: 'Range wall in remodeled kitchen' },
  { src: 'photos/k-5.jpg', category: 'kitchen', caption: 'Dining room cabinetry' },
];

// key, filter tab label, label on the photo
export const CATEGORIES = [
  ['kitchen', 'Kitchens', 'Kitchen'],
  ['bath', 'Bathrooms', 'Bath'],
  ['outdoor', 'Lanais & summer kitchens', 'Lanai'],
  ['addition', 'Additions', 'Addition'],
];

export const categoryTag = key => (CATEGORIES.find(c => c[0] === key) || [])[2] || '';
