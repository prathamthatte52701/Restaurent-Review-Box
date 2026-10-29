import {
  Utensils, Pizza, Soup, Salad, Coffee, Cake, IceCreamCone, Beef, Fish, Sandwich, Wine, Beer, Flame, Leaf, Croissant, Cookie,
  Wifi, Car, Snowflake, Music, Tv, Baby, Accessibility, TreePine, CreditCard, Truck, PartyPopper, Armchair, Cigarette, Dog, Sparkles, CircleHelp,
} from 'lucide-react';

export const ICONS = {
  utensils: Utensils, pizza: Pizza, soup: Soup, salad: Salad, coffee: Coffee, cake: Cake, 'ice-cream-cone': IceCreamCone, beef: Beef,
  fish: Fish, sandwich: Sandwich, wine: Wine, beer: Beer, flame: Flame, leaf: Leaf, croissant: Croissant, cookie: Cookie,
  wifi: Wifi, car: Car, snowflake: Snowflake, music: Music, tv: Tv, baby: Baby, accessibility: Accessibility, 'tree-pine': TreePine,
  'credit-card': CreditCard, truck: Truck, 'party-popper': PartyPopper, armchair: Armchair, cigarette: Cigarette, dog: Dog, sparkles: Sparkles,
};
export const ICON_OPTIONS = [{ value: '', label: 'No icon' }, ...Object.keys(ICONS).map((k) => ({ value: k, label: k }))];
export const iconFor = (name) => ICONS[name] || null;
export { CircleHelp };
