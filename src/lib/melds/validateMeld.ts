import { IndicatorInfo } from '../../types/game';
import { Meld } from '../../types/meld';
import { Tile, TileColor } from '../../types/tile';
import { isOkey } from '../tiles/okey';

function isWildcard(tile: Tile, indicator: IndicatorInfo): boolean {
  return isOkey(tile, indicator);
}

export function validateGroup(tiles: Tile[], indicator: IndicatorInfo): boolean {
  if (tiles.length < 3 || tiles.length > 4) return false;

  const realTiles = tiles.filter(t => !isWildcard(t, indicator));
  if (realTiles.length === 0) return tiles.length >= 3;

  const first = realTiles[0] as Extract<Tile, { kind: 'numbered' }>;
  if (first.kind !== 'numbered') return false;

  const targetNum = first.number;
  const colors = new Set<TileColor>();

  for (const tile of realTiles) {
    if (tile.kind !== 'numbered') return false;
    if (tile.number !== targetNum) return false;
    if (colors.has(tile.color)) return false;
    colors.add(tile.color);
  }
  return true;
}

export function validateRun(tiles: Tile[], indicator: IndicatorInfo): boolean {
  if (tiles.length < 3) return false;

  const realTiles = tiles.filter(t => !isWildcard(t, indicator));
  const wildcardCount = tiles.length - realTiles.length;

  if (realTiles.length === 0) return wildcardCount >= 3;

  const first = realTiles[0] as Extract<Tile, { kind: 'numbered' }>;
  if (first.kind !== 'numbered') return false;

  const targetColor = first.color;
  for (const tile of realTiles) {
    if (tile.kind !== 'numbered') return false;
    if (tile.color !== targetColor) return false;
  }

  const nums = realTiles.map(t => (t as Extract<Tile, { kind: 'numbered' }>).number).sort((a, b) => a - b);
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i + 1]) return false;
  }

  const span = nums[nums.length - 1] - nums[0] + 1;
  const gaps = span - realTiles.length;
  if (gaps > wildcardCount) return false;
  if (span > 13 || tiles.length > 13) return false;

  return true;
}

// 5 çift açma — 5 pair of matching tiles (same number + same color)
export function validateFivePairs(tiles: Tile[], indicator: IndicatorInfo): boolean {
  if (tiles.length !== 10) return false;

  // Group tiles by (color, number)
  const counts = new Map<string, number>();
  for (const tile of tiles) {
    if (isWildcard(tile, indicator)) continue;
    if (tile.kind !== 'numbered') return false;
    const key = `${tile.color}-${tile.number}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const wildcards = tiles.filter(t => isWildcard(t, indicator)).length;
  let pairs = 0;
  let singles = 0;

  for (const count of counts.values()) {
    pairs += Math.floor(count / 2);
    singles += count % 2;
  }

  // Wildcards can complete singles into pairs
  const wildcardsNeeded = singles;
  if (wildcards < wildcardsNeeded) return false;

  return pairs + Math.floor((singles + wildcards) / 2) >= 5;
}

export function meldPoints(tiles: Tile[], indicator: IndicatorInfo): number {
  return tiles.reduce((sum, tile) => {
    if (tile.kind === 'fake-joker') return sum + 30;
    if (isWildcard(tile, indicator)) return sum + tile.number;
    return sum + tile.number;
  }, 0);
}

// Total points across all melds (for 101-point opening check)
export function totalMeldPoints(melds: Array<{ tiles: Tile[] }>, indicator: IndicatorInfo): number {
  return melds.reduce((sum, m) => sum + meldPoints(m.tiles, indicator), 0);
}

export function validateMeld(meld: Omit<Meld, 'id' | 'ownerId'>, indicator: IndicatorInfo): boolean {
  if (meld.type === 'group') return validateGroup(meld.tiles, indicator);
  return validateRun(meld.tiles, indicator);
}

export function detectMeldType(tiles: Tile[], indicator: IndicatorInfo): 'group' | 'run' | null {
  if (validateGroup(tiles, indicator)) return 'group';
  if (validateRun(tiles, indicator)) return 'run';
  return null;
}
