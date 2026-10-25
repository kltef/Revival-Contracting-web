// Services are sorted by how many estimate requests each one gets; the top one is labeled "Most requested".
// Until real counts are wired up, DEFAULT_COUNTS puts Custom kitchens on top.
export const DEFAULT_COUNTS = { kitchen: 1 };

export const TYPE_TO_SERVICE = { 'Kitchen': 'kitchen', 'Bathroom': 'bath', 'Lanai': 'outdoor', 'Summer kitchen': 'outdoor', 'Addition': 'addition' };

// Highest count first; ties and missing or non-numeric counts keep the original order.
export function orderServices(services, counts) {
  if (!counts) return services;
  const n = s => +counts[s.key] || 0;
  return services.map((s, i) => [s, i]).sort((a, b) => (n(b[0]) - n(a[0])) || (a[1] - b[1])).map(([s]) => s);
}
