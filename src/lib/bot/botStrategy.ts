import { IndicatorInfo } from '../../types/game';
import { Tile, TileColor, TileNumber } from '../../types/tile';
import { isOkey } from '../tiles/okey';

function tileScore(tile: Tile, hand: Tile[], indicator: IndicatorInfo): number {
  if (tile.kind === 'fake-joker' || isOkey(tile, indicator)) return 999;

  const color = tile.color;
  const num = tile.number;
  let score = 0;

  // Bonus for each same-color adjacent tile (potential run)
  const sameColorNums = hand
    .filter(t => t.kind === 'numbered' && t.color === color && t.id !== tile.id)
    .map(t => (t as Extract<Tile, { kind: 'numbered' }>).number);

  for (const n of sameColorNums) {
    if (Math.abs(n - num) <= 2) score += 3;
    if (Math.abs(n - num) === 1) score += 5;
  }

  // Bonus for same-number different-color tiles (potential group)
  const sameNumColors = hand
    .filter(t => t.kind === 'numbered' && (t as Extract<Tile, { kind: 'numbered' }>).number === num && t.id !== tile.id)
    .map(t => (t as Extract<Tile, { kind: 'numbered' }>).color);

  score += sameNumColors.length * 4;

  return score;
}

export function getBotDiscard(hand: Tile[], indicator: IndicatorInfo): Tile {
  // Never discard okey or fake jokers
  const candidates = hand.filter(t => t.kind !== 'fake-joker' && !isOkey(t, indicator));

  if (candidates.length === 0) return hand[hand.length - 1];

  // Pick the tile with lowest "usefulness" score
  let worstTile = candidates[0];
  let worstScore = tileScore(candidates[0], hand, indicator);

  for (const tile of candidates.slice(1)) {
    const s = tileScore(tile, hand, indicator);
    if (s < worstScore) {
      worstScore = s;
      worstTile = tile;
    }
  }

  return worstTile;
}
