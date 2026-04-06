// Area and item definitions for inspections

export interface AreaItemDef {
  name: string;
  defaultStatus: 'good' | 'needs_repair' | 'urgent';
}

export interface AreaDef {
  key: string;
  label: string;
  items: AreaItemDef[];
  requiresToggle?: 'has_garage' | 'has_laundry' | 'has_exterior';
  perRoom?: 'bedrooms' | 'bathrooms' | 'living_rooms';
}

const bedroomItems: AreaItemDef[] = [
  { name: 'Walls & Ceiling', defaultStatus: 'good' },
  { name: 'Flooring', defaultStatus: 'good' },
  { name: 'Windows & Blinds', defaultStatus: 'good' },
  { name: 'Closet', defaultStatus: 'good' },
  { name: 'Lighting & Outlets', defaultStatus: 'good' },
  { name: 'Door & Hardware', defaultStatus: 'good' },
  { name: 'Smoke Detector', defaultStatus: 'good' },
];

const bathroomItems: AreaItemDef[] = [
  { name: 'Walls & Ceiling', defaultStatus: 'good' },
  { name: 'Flooring', defaultStatus: 'good' },
  { name: 'Toilet', defaultStatus: 'good' },
  { name: 'Sink & Faucet', defaultStatus: 'good' },
  { name: 'Tub / Shower', defaultStatus: 'good' },
  { name: 'Mirror & Cabinet', defaultStatus: 'good' },
  { name: 'Exhaust Fan', defaultStatus: 'good' },
  { name: 'Caulking & Grout', defaultStatus: 'good' },
];

const livingRoomItems: AreaItemDef[] = [
  { name: 'Walls & Ceiling', defaultStatus: 'good' },
  { name: 'Flooring', defaultStatus: 'good' },
  { name: 'Windows & Blinds', defaultStatus: 'good' },
  { name: 'Lighting & Outlets', defaultStatus: 'good' },
  { name: 'Front Door & Hardware', defaultStatus: 'good' },
];

const kitchenItems: AreaItemDef[] = [
  { name: 'Walls & Ceiling', defaultStatus: 'good' },
  { name: 'Flooring', defaultStatus: 'good' },
  { name: 'Countertops', defaultStatus: 'good' },
  { name: 'Cabinets & Drawers', defaultStatus: 'good' },
  { name: 'Sink & Faucet', defaultStatus: 'good' },
  { name: 'Stove / Oven', defaultStatus: 'good' },
  { name: 'Refrigerator', defaultStatus: 'good' },
  { name: 'Dishwasher', defaultStatus: 'good' },
  { name: 'Microwave', defaultStatus: 'good' },
  { name: 'Garbage Disposal', defaultStatus: 'good' },
  { name: 'Exhaust Hood', defaultStatus: 'good' },
];

const hvacItems: AreaItemDef[] = [
  { name: 'HVAC Unit', defaultStatus: 'good' },
  { name: 'Thermostat', defaultStatus: 'good' },
  { name: 'Air Filter', defaultStatus: 'good' },
  { name: 'Ductwork / Vents', defaultStatus: 'good' },
  { name: 'A/C Condenser', defaultStatus: 'good' },
];

const garageItems: AreaItemDef[] = [
  { name: 'Garage Door', defaultStatus: 'good' },
  { name: 'Garage Opener', defaultStatus: 'good' },
  { name: 'Flooring', defaultStatus: 'good' },
  { name: 'Walls & Ceiling', defaultStatus: 'good' },
  { name: 'Lighting', defaultStatus: 'good' },
];

const laundryItems: AreaItemDef[] = [
  { name: 'Washer Hookups', defaultStatus: 'good' },
  { name: 'Dryer Hookups / Vent', defaultStatus: 'good' },
  { name: 'Flooring', defaultStatus: 'good' },
  { name: 'Walls', defaultStatus: 'good' },
];

const exteriorItems: AreaItemDef[] = [
  { name: 'Front Entrance', defaultStatus: 'good' },
  { name: 'Patio / Deck', defaultStatus: 'good' },
  { name: 'Fencing', defaultStatus: 'good' },
  { name: 'Landscaping', defaultStatus: 'good' },
  { name: 'Exterior Walls', defaultStatus: 'good' },
  { name: 'Gutters / Downspouts', defaultStatus: 'good' },
];

export const BASE_AREAS: AreaDef[] = [
  { key: 'kitchen', label: 'Kitchen', items: kitchenItems },
  { key: 'hvac', label: 'HVAC / A-C', items: hvacItems },
  { key: 'bedroom', label: 'Bedroom', items: bedroomItems, perRoom: 'bedrooms' },
  { key: 'bathroom', label: 'Bathroom', items: bathroomItems, perRoom: 'bathrooms' },
  { key: 'living_room', label: 'Living Room', items: livingRoomItems, perRoom: 'living_rooms' },
  { key: 'garage', label: 'Garage', items: garageItems, requiresToggle: 'has_garage' },
  { key: 'laundry', label: 'Laundry', items: laundryItems, requiresToggle: 'has_laundry' },
  { key: 'exterior', label: 'Exterior / Patio', items: exteriorItems, requiresToggle: 'has_exterior' },
];

export function buildAreas(config: {
  bedrooms: number;
  bathrooms: number;
  living_rooms: number;
  has_garage: boolean;
  has_laundry: boolean;
  has_exterior: boolean;
}): { key: string; label: string; items: AreaItemDef[] }[] {
  const areas: { key: string; label: string; items: AreaItemDef[] }[] = [];

  for (const area of BASE_AREAS) {
    if (area.requiresToggle && !config[area.requiresToggle]) continue;

    if (area.perRoom) {
      const count = config[area.perRoom] ?? 1;
      for (let i = 1; i <= count; i++) {
        areas.push({
          key: `${area.key}_${i}`,
          label: count > 1 ? `${area.label} ${i}` : area.label,
          items: [...area.items],
        });
      }
    } else {
      areas.push({ key: area.key, label: area.label, items: [...area.items] });
    }
  }

  return areas;
}
