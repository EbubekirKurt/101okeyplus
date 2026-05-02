import { IndicatorInfo } from '../../types/game';
import { Tile } from '../../types/tile';
import { isOkey } from '../tiles/okey';

export function tileValue(tile: Tile, indicator: IndicatorInfo): number {
  if (tile.kind === 'fake-joker') return 30;
  if (isOkey(tile, indicator)) return tile.number; // okey counts as its face value when scoring hand
  return tile.number;
}

export function scoreHand(tiles: Tile[], indicator: IndicatorInfo): number {
  return tiles.reduce((sum, t) => sum + tileValue(t, indicator), 0);
}

export const PENALTY = {
  CANNOT_OPEN: 202,       // Oyun biterken açamamış
  OKEY_END: 404,          // Çekilecek taş kalmadan (okey ile) oyun biterken açamamış
  THREW_OKEY: 101,        // Okey taşını attı
  ISLEK: 101,             // İşlek taş atıldı ve rakip "işlek" dedi
} as const;
