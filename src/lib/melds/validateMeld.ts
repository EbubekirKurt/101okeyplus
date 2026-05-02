import { IndicatorInfo } from '../../types/game';
import { Meld } from '../../types/meld';
import { Tile, TileColor } from '../../types/tile';
import { isOkey, tileMeldFace, type TileMeldFace } from '../tiles/okey';

const GROUP_COLOR_ORDER: TileColor[] = ['red', 'blue', 'black', 'yellow'];

export function validateGroup(tiles: Tile[], indicator: IndicatorInfo): boolean {
  if (tiles.length < 3 || tiles.length > 4) return false;

  const faces = tiles.map(t => tileMeldFace(t, indicator));
  if (faces.some(f => f === null)) return false;

  const wildCount = faces.filter(f => f!.kind === 'wildcard').length;
  const fixed = faces.filter((f): f is Extract<TileMeldFace, { kind: 'fixed' }> => f!.kind === 'fixed');

  if (fixed.length === 0) return tiles.length >= 3;

  const targetNum = fixed[0].number;
  const colors = new Set<TileColor>();

  for (const f of fixed) {
    if (f.number !== targetNum) return false;
    if (colors.has(f.color)) return false;
    colors.add(f.color);
  }
  return true;
}

export function validateRun(tiles: Tile[], indicator: IndicatorInfo): boolean {
  if (tiles.length < 3) return false;

  const faces = tiles.map(t => tileMeldFace(t, indicator));
  if (faces.some(f => f === null)) return false;

  const fixed = faces.filter((f): f is Extract<TileMeldFace, { kind: 'fixed' }> => f!.kind === 'fixed');
  const wildcardCount = faces.filter(f => f!.kind === 'wildcard').length;

  if (fixed.length === 0) return wildcardCount >= 3;

  const targetColor = fixed[0].color;
  for (const f of fixed) {
    if (f.color !== targetColor) return false;
  }

  const nums = fixed.map(f => f.number).sort((a, b) => a - b);
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i + 1]) return false;
  }

  const span = nums[nums.length - 1] - nums[0] + 1;
  const gaps = span - fixed.length;
  if (gaps > wildcardCount) return false;
  if (span > 13 || tiles.length > 13) return false;

  return true;
}

/** N çift açma (5 veya 10): aynı renk ve sayıdan çiftler; gerçek okey joker sayılır. */
export function validateNPairs(tiles: Tile[], indicator: IndicatorInfo, pairCount: number): boolean {
  if (tiles.length !== pairCount * 2) return false;

  const counts = new Map<string, number>();
  for (const tile of tiles) {
    const f = tileMeldFace(tile, indicator);
    if (f === null) return false;
    if (f.kind === 'wildcard') continue;
    const key = `${f.color}-${f.number}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const wildcards = tiles.filter(t => {
    const f = tileMeldFace(t, indicator);
    return f?.kind === 'wildcard';
  }).length;

  let pairs = 0;
  let singles = 0;

  for (const count of counts.values()) {
    pairs += Math.floor(count / 2);
    singles += count % 2;
  }

  const wildcardsNeeded = singles;
  if (wildcards < wildcardsNeeded) return false;

  return pairs + Math.floor((singles + wildcards) / 2) >= pairCount;
}

export function validateFivePairs(tiles: Tile[], indicator: IndicatorInfo): boolean {
  return validateNPairs(tiles, indicator, 5);
}

function meldPointsLegacyPhysical(tiles: Tile[], indicator: IndicatorInfo): number {
  return tiles.reduce((sum, tile) => {
    if (tile.kind === 'fake-joker') return sum + 30;
    if (isOkey(tile, indicator)) return sum + tile.number;
    if (tile.kind === 'numbered') return sum + tile.number;
    return sum;
  }, 0);
}

function meldPointsGroup(tiles: Tile[], indicator: IndicatorInfo): number {
  const faces = tiles.map(t => tileMeldFace(t, indicator));
  const fixed = faces.filter((f): f is Extract<TileMeldFace, { kind: 'fixed' }> => f?.kind === 'fixed');
  const targetNum = fixed.length > 0 ? fixed[0].number : indicator.okeyNumber;
  let sum = 0;
  for (const t of tiles) {
    if (t.kind === 'fake-joker') sum += 30;
    else if (isOkey(t, indicator)) sum += targetNum;
    else if (t.kind === 'numbered') sum += t.number;
  }
  return sum;
}

function meldPointsRun(tiles: Tile[], indicator: IndicatorInfo): number {
  const n = tiles.length;
  for (let low = 1; low <= 13; low++) {
    const high = low + n - 1;
    if (high > 13) break;
    const ordered = tryAssignRunInterval(low, high, tiles, indicator);
    if (!ordered) continue;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const t = ordered[i];
      if (t.kind === 'fake-joker') sum += 30;
      else sum += low + i;
    }
    return sum;
  }
  return 0;
}

/**
 * Per-meld puan: gerçek okey, seride/grupta temsil ettiği sayı ile sayılır (13 yerine duruyorsa 13).
 * Geçersiz seçimde (önizleme) fiziksel yüz toplamına düşülür.
 */
export function meldPoints(tiles: Tile[], indicator: IndicatorInfo, meldType?: 'group' | 'run'): number {
  if (meldType === 'group' && validateGroup(tiles, indicator)) return meldPointsGroup(tiles, indicator);
  if (meldType === 'run' && validateRun(tiles, indicator)) return meldPointsRun(tiles, indicator);
  const dt = detectMeldType(tiles, indicator);
  if (dt === 'group') return meldPointsGroup(tiles, indicator);
  if (dt === 'run') return meldPointsRun(tiles, indicator);
  return meldPointsLegacyPhysical(tiles, indicator);
}

// Total points across all melds (for 101-point opening check)
export function totalMeldPoints(
  melds: Array<{ tiles: Tile[]; type?: 'group' | 'run' }>,
  indicator: IndicatorInfo,
): number {
  return melds.reduce((sum, m) => sum + meldPoints(m.tiles, indicator, m.type), 0);
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

/** [low, high] aralığına taşları (sabit sayı + joker) yerleştirilebiliyorsa sol→sağ sıra döner. */
function tryAssignRunInterval(low: number, high: number, tiles: Tile[], indicator: IndicatorInfo): Tile[] | null {
  const need = high - low + 1;
  if (need !== tiles.length) return null;
  const slot: (Tile | null)[] = Array(need).fill(null);
  const wilds: Tile[] = [];
  for (const t of tiles) {
    const f = tileMeldFace(t, indicator);
    if (!f) return null;
    if (f.kind === 'wildcard') {
      wilds.push(t);
      continue;
    }
    const pos = f.number - low;
    if (pos < 0 || pos >= need) return null;
    if (slot[pos]) return null;
    slot[pos] = t;
  }
  for (let i = 0; i < need; i++) {
    if (slot[i] === null) {
      const w = wilds.shift();
      if (!w) return null;
      slot[i] = w;
    }
  }
  if (wilds.length > 0) return null;
  return slot as Tile[];
}

/** Geçerli serideki taşları artan sayı sırasına (masada sol→sağ) koyar; 7-8-9’a 6 veya 10 eklenince doğru uçta durur. */
export function orderRunTilesForDisplay(tiles: Tile[], indicator: IndicatorInfo): Tile[] | null {
  if (!validateRun(tiles, indicator)) return null;
  const n = tiles.length;
  for (let low = 1; low <= 13; low++) {
    const high = low + n - 1;
    if (high > 13) break;
    const ordered = tryAssignRunInterval(low, high, tiles, indicator);
    if (ordered) return ordered;
  }
  return null;
}

/** Geçerli grupta taşları renk sırasına göre dizeler (jokerler sonda). */
export function orderGroupTilesForDisplay(tiles: Tile[], indicator: IndicatorInfo): Tile[] | null {
  if (!validateGroup(tiles, indicator)) return null;
  const wilds: Tile[] = [];
  const fixed: Tile[] = [];
  for (const t of tiles) {
    const f = tileMeldFace(t, indicator);
    if (!f) continue;
    if (f.kind === 'wildcard') wilds.push(t);
    else fixed.push(t);
  }
  const colorIdx = (t: Tile) => {
    const f = tileMeldFace(t, indicator);
    if (!f || f.kind !== 'fixed') return 99;
    return GROUP_COLOR_ORDER.indexOf(f.color);
  };
  const rank = (t: Tile) => {
    const f = tileMeldFace(t, indicator);
    return f?.kind === 'fixed' ? f.number : 0;
  };
  fixed.sort((a, b) => {
    const ca = colorIdx(a);
    const cb = colorIdx(b);
    if (ca !== cb) return ca - cb;
    return rank(a) - rank(b);
  });
  return [...fixed, ...wilds];
}
