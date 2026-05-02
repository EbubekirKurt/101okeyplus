import { IndicatorInfo } from '../../types/game';
import { Meld } from '../../types/meld';
import { Tile, TileColor, TileNumber } from '../../types/tile';
import {
  meldPoints as meldPointsWithIndicator,
  orderGroupTilesForDisplay,
  orderRunTilesForDisplay,
  validateGroup,
  validateRun,
} from '../melds/validateMeld';
import { isMeldWildcard, runColor, runRank } from '../tiles/okey';

/** İstaka boyutu; bitmask DP için üst sınır (22 = dealer eli). */
const LIVE_MELDS_OPTIMAL_MAX_TILES = 22;

// ── Types ──────────────────────────────────────────────────────────────────

export interface DetectedMeld {
  indices: number[];   // positions in the tile array
  type: 'run' | 'group';
  points: number;
}

export interface LiveDetection {
  melds: DetectedMeld[];
  meldedIndices: Set<number>;
  totalPoints: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const SERI_SINGLES_COLOR_ORDER: TileColor[] = ['red', 'blue', 'black', 'yellow'];

function reorderSameColorSinglesSpineThenDupes(tiles: Tile[], indicator: IndicatorInfo): Tile[] {
  if (tiles.length <= 1) return tiles;
  const sorted = [...tiles].sort((a, b) => {
    const na = runRank(a, indicator) ?? 0;
    const nb = runRank(b, indicator) ?? 0;
    if (na !== nb) return na - nb;
    return a.id.localeCompare(b.id);
  });
  const byRank = new Map<number, Tile[]>();
  for (const t of sorted) {
    const n = runRank(t, indicator);
    if (n == null) continue;
    const arr = byRank.get(n) ?? [];
    arr.push(t);
    byRank.set(n, arr);
  }
  const sortedRanks = [...byRank.keys()].sort((a, b) => a - b);
  const spine: Tile[] = [];
  for (const r of sortedRanks) {
    const bucket = byRank.get(r)!;
    if (bucket.length > 0) spine.push(bucket.shift()!);
  }
  const tail: Tile[] = [];
  for (const r of sortedRanks) {
    const bucket = byRank.get(r)!;
    while (bucket.length > 0) tail.push(bucket.shift()!);
  }
  return [...spine, ...tail];
}

function sortSinglesSeri(tiles: Tile[], indicator: IndicatorInfo): Tile[] {
  const nullColor: Tile[] = [];
  const byColor: Record<TileColor, Tile[]> = {
    red: [], blue: [], black: [], yellow: [],
  };
  for (const t of tiles) {
    const c = runColor(t, indicator);
    if (c === null) nullColor.push(t);
    else byColor[c].push(t);
  }
  const out: Tile[] = [];
  for (const col of SERI_SINGLES_COLOR_ORDER) {
    out.push(...reorderSameColorSinglesSpineThenDupes(byColor[col], indicator));
  }
  out.push(...nullColor);
  return out;
}

/** Maksimum seri (≥3 taş) — `used` dışındaki indeksler kullanılır. */
function collectRunFrom(tiles: Tile[], indicator: IndicatorInfo, start: number, used: Set<number>): number[] {
  const runIndices: number[] = [start];
  const t0 = tiles[start];
  const color0 = isMeldWildcard(t0, indicator) ? null : runColor(t0, indicator);

  for (let j = start + 1; j < tiles.length && runIndices.length < 13; j++) {
    if (used.has(j)) break;
    const tj = tiles[j];
    if (isMeldWildcard(tj, indicator)) {
      runIndices.push(j);
      continue;
    }

    const cj = runColor(tj, indicator);
    const nj = runRank(tj, indicator);
    if (!cj || nj === null) break;

    const effectiveColor = color0 ?? cj;
    if (cj !== effectiveColor) break;

    const lastReal = [...runIndices].reverse().find(i => runRank(tiles[i], indicator) !== null);
    if (lastReal === undefined) { runIndices.push(j); continue; }
    const lastNum = runRank(tiles[lastReal], indicator)!;
    if (nj === lastNum + 1) {
      runIndices.push(j);
    } else {
      break;
    }
  }

  return runIndices.length >= 3 ? runIndices : [];
}

/** Maksimum grup (aynı sayı, farklı renk; 3–4 taş) — `used` dışındaki indeksler. */
function collectGroupFrom(tiles: Tile[], indicator: IndicatorInfo, start: number, used: Set<number>): number[] {
  const t0 = tiles[start];
  const color0 = isMeldWildcard(t0, indicator) ? null : runColor(t0, indicator);
  const n0 = isMeldWildcard(t0, indicator) ? null : runRank(t0, indicator);
  const groupIndices: number[] = [start];
  const groupColors = new Set<TileColor>(color0 ? [color0] : []);

  for (let j = start + 1; j < tiles.length && groupIndices.length < 4; j++) {
    if (used.has(j)) break;
    const tj = tiles[j];
    if (isMeldWildcard(tj, indicator)) { groupIndices.push(j); continue; }

    const nj = runRank(tj, indicator);
    const cj = runColor(tj, indicator);
    if (nj === null || !cj) break;

    const effectiveNum = n0 ?? nj;
    if (nj !== effectiveNum) break;
    if (groupColors.has(cj)) break;

    groupColors.add(cj);
    groupIndices.push(j);
  }

  return groupIndices.length >= 3 ? groupIndices : [];
}

// ── Optimal live melds (max total points, disjoint) ─────────────────────────

function maskToIndices(mask: number, n: number): number[] {
  const r: number[] = [];
  for (let b = 0; b < n; b++) if (mask & (1 << b)) r.push(b);
  return r;
}

function indicesToMask(indices: number[]): number {
  let m = 0;
  for (const idx of indices) m |= 1 << idx;
  return m;
}

function lowestSetBit(mask: number, n: number): number {
  for (let b = 0; b < n; b++) if (mask & (1 << b)) return b;
  return -1;
}

function combinations(arr: number[], k: number): number[][] {
  const result: number[][] = [];
  function bt(start: number, combo: number[]) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let j = start; j < arr.length; j++) {
      combo.push(arr[j]);
      bt(j + 1, combo);
      combo.pop();
    }
  }
  bt(0, []);
  return result;
}

function combinationsIncluding(pool: number[], k: number, must: number): number[][] {
  if (k <= 0 || !pool.includes(must)) return [];
  if (k === 1) return [[must]];
  const rest = pool.filter(x => x !== must);
  return combinations(rest, k - 1).map(c => [...c, must].sort((a, b) => a - b));
}

function runPoolsForIndex(
  i: number,
  available: number[],
  tiles: Tile[],
  indicator: IndicatorInfo,
): number[][] {
  const ti = tiles[i];
  if (isMeldWildcard(ti, indicator)) {
    const pools: number[][] = [];
    for (const col of SERI_SINGLES_COLOR_ORDER) {
      const pool = available.filter(j => {
        const tj = tiles[j];
        if (isMeldWildcard(tj, indicator)) return true;
        return runColor(tj, indicator) === col;
      });
      if (pool.includes(i)) pools.push(pool);
    }
    return pools;
  }
  const c = runColor(ti, indicator);
  if (!c) return [];
  const pool = available.filter(j => {
    const tj = tiles[j];
    if (isMeldWildcard(tj, indicator)) return true;
    return runColor(tj, indicator) === c;
  });
  return pool.includes(i) ? [pool] : [];
}

function tileCanRepresentRunRank(idx: number, rank: number, tiles: Tile[], indicator: IndicatorInfo): boolean {
  const t = tiles[idx];
  if (isMeldWildcard(t, indicator)) return true;
  return runRank(t, indicator) === rank;
}

/** [low,high] aralığı için `pool` içinden `mustInclude` dahil tüm geçerli taş alt kümeleri. */
function findRunSubsetsForInterval(
  pool: number[],
  mustInclude: number,
  low: number,
  high: number,
  tiles: Tile[],
  indicator: IndicatorInfo,
): number[][] {
  const ranks: number[] = [];
  for (let r = low; r <= high; r++) ranks.push(r);
  const raw: number[][] = [];

  function backtrack(ri: number, chosen: number[]): void {
    if (ri === ranks.length) {
      if (chosen.includes(mustInclude)) raw.push([...chosen]);
      return;
    }
    const rank = ranks[ri];
    for (const idx of pool) {
      if (chosen.includes(idx)) continue;
      if (!tileCanRepresentRunRank(idx, rank, tiles, indicator)) continue;
      chosen.push(idx);
      backtrack(ri + 1, chosen);
      chosen.pop();
    }
  }
  backtrack(0, []);

  const seen = new Set<string>();
  const out: number[][] = [];
  for (const row of raw) {
    const key = [...row].sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row.sort((a, b) => a - b));
  }
  return out;
}

function enumerateMeldsContaining(
  i: number,
  available: number[],
  tiles: Tile[],
  indicator: IndicatorInfo,
): DetectedMeld[] {
  const seen = new Set<string>();
  const out: DetectedMeld[] = [];

  const pushMeld = (indices: number[], type: 'run' | 'group') => {
    const key = [...indices].sort((a, b) => a - b).join(',');
    if (seen.has(key)) return;
    const ts = indices.map(idx => tiles[idx]);
    const ok = type === 'group' ? validateGroup(ts, indicator) : validateRun(ts, indicator);
    if (!ok) return;
    seen.add(key);
    out.push({
      indices: [...indices].sort((a, b) => a - b),
      type,
      points: meldPointsWithIndicator(ts, indicator, type),
    });
  };

  for (const k of [3, 4]) {
    if (available.length < k) continue;
    for (const combo of combinationsIncluding(available, k, i)) {
      pushMeld(combo, 'group');
    }
  }

  for (const pool of runPoolsForIndex(i, available, tiles, indicator)) {
    const maxLen = Math.min(13, pool.length);
    for (let len = 3; len <= maxLen; len++) {
      for (let low = 1; low + len - 1 <= 13; low++) {
        const high = low + len - 1;
        for (const subset of findRunSubsetsForInterval(pool, i, low, high, tiles, indicator)) {
          pushMeld(subset, 'run');
        }
      }
    }
  }

  return out;
}

function detectLiveMeldsOptimal(tiles: Tile[], indicator: IndicatorInfo): LiveDetection {
  const n = tiles.length;
  if (n === 0) {
    return { melds: [], meldedIndices: new Set(), totalPoints: 0 };
  }
  const fullMask = (1 << n) - 1;
  const memo = new Map<number, { total: number; melds: DetectedMeld[] }>();

  function best(mask: number): { total: number; melds: DetectedMeld[] } {
    if (mask === 0) return { total: 0, melds: [] };
    const cached = memo.get(mask);
    if (cached) return cached;

    const i = lowestSetBit(mask, n);
    const withoutI = mask ^ (1 << i);
    let bestResult = best(withoutI);

    const available = maskToIndices(mask, n);
    for (const cand of enumerateMeldsContaining(i, available, tiles, indicator)) {
      const mmask = indicesToMask(cand.indices);
      if ((mmask & mask) !== mmask) continue;
      const nextMask = mask & ~mmask;
      const sub = best(nextMask);
      const total = cand.points + sub.total;
      if (total > bestResult.total) {
        bestResult = {
          total,
          melds: [{ indices: cand.indices, type: cand.type, points: cand.points }, ...sub.melds],
        };
      }
    }

    memo.set(mask, bestResult);
    return bestResult;
  }

  const r = best(fullMask);
  return {
    melds: r.melds,
    meldedIndices: new Set(r.melds.flatMap(m => m.indices)),
    totalPoints: r.total,
  };
}

// ── Live detection ────────────────────────────────────────────────────────

/** Soldan sağa aç gözlü; çok taşlı ellerde yedek. */
function detectLiveMeldsGreedy(tiles: Tile[], indicator: IndicatorInfo): LiveDetection {
  const used = new Set<number>();
  const melds: DetectedMeld[] = [];

  for (let start = 0; start < tiles.length; start++) {
    if (used.has(start)) continue;

    const runIdx = collectRunFrom(tiles, indicator, start, used);
    const grpIdx = collectGroupFrom(tiles, indicator, start, used);

    let chosen: { indices: number[]; type: 'run' | 'group'; points: number } | null = null;

    if (runIdx.length && grpIdx.length) {
      const rp = meldPointsWithIndicator(runIdx.map(i => tiles[i]), indicator, 'run');
      const gp = meldPointsWithIndicator(grpIdx.map(i => tiles[i]), indicator, 'group');
      if (gp > rp) {
        chosen = { indices: grpIdx, type: 'group', points: gp };
      } else if (rp > gp) {
        chosen = { indices: runIdx, type: 'run', points: rp };
      } else if (grpIdx.length > runIdx.length) {
        chosen = { indices: grpIdx, type: 'group', points: gp };
      } else {
        chosen = { indices: runIdx, type: 'run', points: rp };
      }
    } else if (grpIdx.length) {
      chosen = { indices: grpIdx, type: 'group', points: meldPointsWithIndicator(grpIdx.map(i => tiles[i]), indicator, 'group') };
    } else if (runIdx.length) {
      chosen = { indices: runIdx, type: 'run', points: meldPointsWithIndicator(runIdx.map(i => tiles[i]), indicator, 'run') };
    }

    if (chosen) {
      melds.push({ indices: [...chosen.indices], type: chosen.type, points: chosen.points });
      chosen.indices.forEach(idx => used.add(idx));
    }
  }

  return {
    melds,
    meldedIndices: used,
    totalPoints: melds.reduce((s, m) => s + m.points, 0),
  };
}

/** Çakışmasız perlerde toplam puanı maksimize eder (okeyleri en karlı serilere dağıtır). */
export function detectLiveMelds(tiles: Tile[], indicator: IndicatorInfo): LiveDetection {
  if (tiles.length > LIVE_MELDS_OPTIMAL_MAX_TILES) {
    return detectLiveMeldsGreedy(tiles, indicator);
  }
  return detectLiveMeldsOptimal(tiles, indicator);
}

export function liveMeldsToOpeningMelds(tiles: Tile[], live: LiveDetection, ownerId: string): Meld[] {
  const ts = Date.now();
  return live.melds.map((m, i) => ({
    id: `${ownerId}-open-${ts}-${i}`,
    type: m.type,
    tiles: m.indices.map(idx => tiles[idx]).filter((t): t is Tile => t != null),
    ownerId,
  }));
}

// ── Auto-arrange core: Seri Diz ───────────────────────────────────────────
//
// İki aşama:
//   Pass 1 — Yalnızca normal taşlarla (okeysiz) renk başına ardışık seriler.
//   Pass 2 — Kalan taşlar + tüm okeyler: detectLiveMelds (global optimal DP)
//            ile seri ve gruplar birlikte maksimum toplam puan.

const COLORS: TileColor[] = ['red', 'blue', 'black', 'yellow'];

function buildRunsFromPool(
  pool: Tile[],
  indicator: IndicatorInfo,
  wildPool: Tile[],
  allowWilds: boolean,
): { runs: Tile[][]; singles: Tile[] } {
  const runs: Tile[][] = [];
  const singles: Tile[] = [];

  while (pool.length > 0) {
    const savedWilds = allowWilds ? [...wildPool] : [];
    const run: Tile[] = [pool[0]];
    const usedIdx = new Set<number>([0]);
    let next = (runRank(pool[0], indicator) ?? 0) + 1;

    let extended = true;
    while (extended) {
      extended = false;
      for (let k = 1; k < pool.length; k++) {
        if (usedIdx.has(k)) continue;
        const rk = runRank(pool[k], indicator);
        if (rk === null || rk < next) continue;
        if (rk === next) {
          run.push(pool[k]); usedIdx.add(k); next++; extended = true; break;
        }
        if (!allowWilds) break;
        const gap = rk - next;
        if (wildPool.length >= gap && gap <= 2) {
          for (let g = 0; g < gap; g++) { run.push(wildPool.shift()!); next++; }
          run.push(pool[k]); usedIdx.add(k); next++; extended = true; break;
        }
        break;
      }
    }

    if (run.length >= 3) {
      runs.push(run);
      [...usedIdx].sort((a, b) => b - a).forEach(i => pool.splice(i, 1));
    } else {
      if (allowWilds) {
        // Restore any wilds consumed during the failed attempt.
        wildPool.length = 0;
        wildPool.push(...savedWilds);
        // Lone tile: pad with 2 wilds to make a minimal 3-tile run if possible.
        const n = runRank(pool[0], indicator);
        if (n !== null && wildPool.length >= 2) {
          const w1 = wildPool.shift()!;
          const w2 = wildPool.shift()!;
          // Extend forward when possible; otherwise prepend wilds.
          if (n <= 11) runs.push([pool.shift()!, w1, w2]);
          else         runs.push([w1, w2, pool.shift()!]);
          continue;
        }
      }
      singles.push(pool.shift()!);
    }
  }

  return { runs, singles };
}

function seriDizCore(
  tiles: Tile[],
  indicator: IndicatorInfo,
): { runs: Tile[][]; groups: Tile[][]; singles: Tile[] } {
  const runs: Tile[][] = [];
  const groups: Tile[][] = [];

  const live = detectLiveMelds(tiles, indicator);
  for (const m of live.melds) {
    const ts = m.indices.map(i => tiles[i]).filter((t): t is Tile => t != null);
    if (m.type === 'run') {
      const ordered = orderRunTilesForDisplay(ts, indicator);
      runs.push(ordered ?? ts);
    } else {
      const ordered = orderGroupTilesForDisplay(ts, indicator);
      groups.push(ordered ?? ts);
    }
  }
  const singles = tiles.filter((_, idx) => !live.meldedIndices.has(idx));

  runs.sort((a, b) => meldPointsWithIndicator(b, indicator, 'run') - meldPointsWithIndicator(a, indicator, 'run'));

  return { runs, groups, singles: sortSinglesSeri(singles, indicator) };
}

export function seriDiz(tiles: Tile[], indicator: IndicatorInfo): Tile[] {
  const { runs, groups, singles } = seriDizCore(tiles, indicator);
  return [...runs.flat(), ...groups.flat(), ...sortSinglesSeri(singles, indicator)];
}

export function seriDizWithGaps(tiles: Tile[], indicator: IndicatorInfo): (Tile | null)[] {
  const { runs, groups, singles } = seriDizCore(tiles, indicator);
  return insertGaps([...runs, ...groups], sortSinglesSeri(singles, indicator));
}

// ── Auto-arrange core: Çift Diz ───────────────────────────────────────────
//
// Yalnızca çiftler (aynı renk+sayı) dizilir; seri/grup oluşturulmaz.
// Kalanlar renk sırasında (kırmızı→mavi→siyah→sarı), sayı artan.

function ciftDizCore(
  tiles: Tile[],
  indicator: IndicatorInfo,
): { pairs: Tile[][]; singles: Tile[] } {
  const pairs: Tile[][] = [];

  // Aynı meld yüzü (renk+sayı) → taş kopyaları. Okey de kendi yüzüne gider.
  const bucketMap = new Map<string, Tile[]>();
  const wilds: Tile[] = [];
  for (const t of tiles) {
    if (isMeldWildcard(t, indicator)) {
      wilds.push(t);
      continue;
    }
    const c = runColor(t, indicator);
    const n = runRank(t, indicator);
    if (!c || n === null) { wilds.push(t); continue; }
    const key = `${c}-${n}`;
    const arr = bucketMap.get(key) ?? [];
    arr.push(t);
    bucketMap.set(key, arr);
  }

  // Doğal çiftler (aynı renk+sayıdan 2 kopya)
  for (const bucket of bucketMap.values()) {
    while (bucket.length >= 2) {
      pairs.push([bucket.shift()!, bucket.shift()!]);
    }
  }

  // Okeyleri en yüksek değerli tekil taşlarla eşleştir
  if (wilds.length > 0) {
    const singleEntries: { key: string; num: number; tile: Tile }[] = [];
    for (const [key, bucket] of bucketMap) {
      if (bucket.length === 1) {
        const num = parseInt(key.split('-')[1]);
        singleEntries.push({ key, num, tile: bucket[0] });
      }
    }
    singleEntries.sort((a, b) => b.num - a.num);

    for (const entry of singleEntries) {
      if (wilds.length === 0) break;
      pairs.push([entry.tile, wilds.shift()!]);
      bucketMap.get(entry.key)!.shift();
    }
  }

  // Önce doğal çiftler, sonra okey çiftleri; her grup içinde büyükten küçüğe
  pairs.sort((a, b) => {
    const hasWildA = a.some(t => isMeldWildcard(t, indicator)) ? 1 : 0;
    const hasWildB = b.some(t => isMeldWildcard(t, indicator)) ? 1 : 0;
    if (hasWildA !== hasWildB) return hasWildA - hasWildB;
    const valA = a.reduce((s, t) => s + (runRank(t, indicator) ?? indicator.okeyNumber), 0);
    const valB = b.reduce((s, t) => s + (runRank(t, indicator) ?? indicator.okeyNumber), 0);
    return valB - valA;
  });

  // Kalanlar: renk sırası (kırmızı→mavi→siyah→sarı), sayı artan.
  const singles: Tile[] = [...wilds];
  for (const bucket of bucketMap.values()) {
    singles.push(...bucket);
  }
  singles.sort((a, b) => {
    const ca = runColor(a, indicator);
    const cb = runColor(b, indicator);
    const ciA = ca ? COLORS.indexOf(ca) : 4;
    const ciB = cb ? COLORS.indexOf(cb) : 4;
    if (ciA !== ciB) return ciA - ciB;
    return (runRank(a, indicator) ?? 0) - (runRank(b, indicator) ?? 0);
  });

  return { pairs, singles };
}

export function ciftDiz(tiles: Tile[], indicator: IndicatorInfo): Tile[] {
  const { pairs, singles } = ciftDizCore(tiles, indicator);
  return [...pairs.flat(), ...singles];
}

export function ciftDizWithGaps(tiles: Tile[], indicator: IndicatorInfo): (Tile | null)[] {
  const { pairs, singles } = ciftDizCore(tiles, indicator);
  return insertGaps(pairs, singles);
}

// ── Shared: insert null gaps between groups ────────────────────────────────

function insertGaps(groups: Tile[][], singles: Tile[]): (Tile | null)[] {
  const result: (Tile | null)[] = [];
  for (let i = 0; i < groups.length; i++) {
    result.push(...groups[i]);
    if (i < groups.length - 1 || singles.length > 0) {
      result.push(null);
    }
  }
  if (singles.length > 0) {
    result.push(...singles);
  }
  return result;
}

/**
 * Gap-separated items → 2×cols grid.
 * Per (null arası taş bloğu) satır sonunda kesilmez; sığmayan blok alt satıra taşınır.
 * Satır doluysa gap'ler daraltılır; yine de sığmazsa blok bölünmeden yan yana eklenir.
 */
export function tilesToGrid(items: (Tile | null)[], cols: number): (Tile | null)[][] {
  const blocks: (Tile | null)[][] = [];
  let cur: (Tile | null)[] = [];
  for (const item of items) {
    if (item === null) {
      if (cur.length > 0) {
        blocks.push(cur);
        cur = [];
      }
    } else {
      cur.push(item);
    }
  }
  if (cur.length > 0) blocks.push(cur);

  const row1: (Tile | null)[] = [];
  const row2: (Tile | null)[] = [];

  function tileCount(row: (Tile | null)[]): number {
    return row.filter(c => c !== null).length;
  }

  function appendBlock(target: (Tile | null)[], block: (Tile | null)[]) {
    if (target.length > 0 && target[target.length - 1] !== null && target.length < cols) {
      target.push(null);
    }
    target.push(...block);
  }

  for (const block of blocks) {
    const gapNeeded = row1.length > 0 && row1[row1.length - 1] !== null ? 1 : 0;
    if (tileCount(row1) + block.length <= cols && row1.length + block.length + gapNeeded <= cols) {
      appendBlock(row1, block);
    } else {
      appendBlock(row2, block);
    }
  }

  while (row1.length < cols) row1.push(null);
  while (row2.length < cols) row2.push(null);

  // Taş kaybını önle: satır taşması varsa kırpma yerine tüm taşları koru.
  // 2 satır × cols = 30 hücre; 22 taş + gap'ler buna sığmalı.
  // Taşma durumunda gap'leri sıkıştır.
  if (row1.length > cols || row2.length > cols) {
    const allTiles = [...row1, ...row2].filter((t): t is Tile => t !== null);
    const half = Math.ceil(allTiles.length / 2);
    const r1 = allTiles.slice(0, half);
    const r2 = allTiles.slice(half);
    const padded1: (Tile | null)[] = [...r1];
    const padded2: (Tile | null)[] = [...r2];
    while (padded1.length < cols) padded1.push(null);
    while (padded2.length < cols) padded2.push(null);
    return [padded1.slice(0, cols), padded2.slice(0, cols)];
  }

  return [row1.slice(0, cols), row2.slice(0, cols)];
}

export function gridToTiles(grid: (Tile | null)[][]): Tile[] {
  return grid.flat().filter((t): t is Tile => t !== null);
}
