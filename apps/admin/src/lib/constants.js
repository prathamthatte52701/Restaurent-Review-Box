export const CATEGORIES = [
  { value: 'restaurant', label: 'Restaurant' }, { value: 'cafe', label: 'Cafe' }, { value: 'bakery', label: 'Bakery' },
  { value: 'street-food', label: 'Street food' }, { value: 'bar', label: 'Bar' }, { value: 'cloud-kitchen', label: 'Cloud kitchen' },
];
export const TYPES = [{ value: 'veg', label: 'Vegetarian' }, { value: 'non-veg', label: 'Non-vegetarian' }, { value: 'both', label: 'Veg and non-veg' }];
export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const labelOf = (list, v) => list.find((o) => o.value === v)?.label || v;
export const inr = (n) => (Number.isFinite(Number(n)) ? `₹${Number(n).toLocaleString('en-IN')}` : '-');
