// Warm, faded 1990s palette. One entry per neighborhood skin (MVP ships one).
export interface Palette {
  skyTop: string;
  skyDusk: string;
  building: string;
  buildingShade: string;
  balcony: string;
  window: string;
  windowLit: string;
  asphalt: string;
  asphalt2: string;
  chalk: string;
  rack: string;
  carBody: string;
  carShade: string;
  carGlass: string;
  stackBase: string;
  teamA: string;
  teamAShade: string;
  teamB: string;
  teamBShade: string;
  ballColor: string;
  shadow: string;
  ink: string;
}

const DUSK_COURTYARD: Palette = {
  skyTop: '#2b202e',
  skyDusk: '#e79a55',
  building: '#7d6e63',
  buildingShade: '#5f5249',
  balcony: '#6a5a4f',
  window: '#3a3140',
  windowLit: '#f2c879',
  asphalt: '#6f675d',
  asphalt2: '#655d54',
  chalk: '#e9e2cf',
  rack: '#4b4138',
  carBody: '#b8c4b0',
  carShade: '#8f9c89',
  carGlass: '#39434a',
  stackBase: '#c98a5a',
  teamA: '#e8703a',
  teamAShade: '#a6451f',
  teamB: '#5aa0c9',
  teamBShade: '#356f90',
  ballColor: '#e85a3a',
  shadow: 'rgba(20,12,10,0.32)',
  ink: '#f3e9d8',
};

const SKINS: Record<string, Palette> = {
  'dusk-courtyard': DUSK_COURTYARD,
};

export function paletteForSkin(skin: string): Palette {
  return SKINS[skin] ?? DUSK_COURTYARD;
}

/** Stone fill colors, cycled by index for variety. */
export const STONE_COLORS = ['#b86b4a', '#9c8a6f', '#c98a5a', '#8a968f', '#d9b06a', '#a8745a', '#bfa173'];
