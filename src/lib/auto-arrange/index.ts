import { IndicatorInfo } from '../../types/game';
import { Meld } from '../../types/meld';
import { Tile, TileColor, TileNumber } from '../../types/tile';
import { isMeldWildcard, runColor, runRank } from '../tiles/okey';

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

function meldPoints(tiles: Tile[]): number {
  return tiles.reduce((s, t) => s + (t.kind === 'numbered' ? t.number : 30), 0);
}

const SERI_SINGLES_COLOR_ORDER: TileColor[] = ['red', 'blue', 'black', 'yellow'];

/**
 * Aynı renkteki tekiller: önce her sayıdan en fazla bir taşlık "omurga" (artan),
 * sonra kalan mükerrerler — böylece 10-11-11-12 gibi geçersiz seri görünümü oluşmaz.
 */
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

/** Per dışı kalan taşlar: renk blokları; renk içinde omurga + mükerrer (yanıltıcı seri dizilimi yok). */
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

// ── Live detection: scan ordered hand for valid melds ─────────────────────
// Greedy left-to-right; her başlangıçta seri ve grup adaylarından puanı yüksek olanı seçer
// (ör. 13-13-13-13 grupları seri uzantısından önce tüketilmesin diye).

export function detectLiveMelds(tiles: Tile[], indicator: IndicatorInfo): LiveDetection {
  const used = new Set<number>();
  const melds: DetectedMeld[] = [];

  for (let start = 0; start < tiles.length; start++) {
    if (used.has(start)) continue;

    const runIdx = collectRunFrom(tiles, indicator, start, used);
    const grpIdx = collectGroupFrom(tiles, indicator, start, used);

    let chosen: { indices: number[]; type: 'run' | 'group'; points: number } | null = null;

    if (runIdx.length && grpIdx.length) {
      const rp = meldPoints(runIdx.map(i => tiles[i]));
      const gp = meldPoints(grpIdx.map(i => tiles[i]));
      if (gp > rp) {
        chosen = { indices: grpIdx, type: 'group', points: gp };
      } else if (rp > gp) {
        chosen = { indices: runIdx, type: 'run', points: rp };
      } else if (grpIdx.length > runIdx.length) {
        chosen = { indices: grpIdx, type: 'group', points: gp };
      } else if (runIdx.length > grpIdx.length) {
        chosen = { indices: runIdx, type: 'run', points: rp };
      } else {
        chosen = { indices: grpIdx, type: 'group', points: gp };
      }
    } else if (grpIdx.length) {
      chosen = {
        indices: grpIdx,
        type: 'group',
        points: meldPoints(grpIdx.map(i => tiles[i])),
      };
    } else if (runIdx.length) {
      chosen = {
        indices: runIdx,
        type: 'run',
        points: meldPoints(runIdx.map(i => tiles[i])),
      };
    }

    if (chosen) {
      melds.push({ indices: [...chosen.indices], type: chosen.type, points: chosen.points });
      chosen.indices.forEach(i => used.add(i));
    }
  }

  return {
    melds,
    meldedIndices: used,
    totalPoints: melds.reduce((s, m) => s + m.points, 0),
  };
}

/** Canlı tespit perlere `open_melds` için Meld[] üretir (ıstaka sırasına göre). */
export function liveMeldsToOpeningMelds(tiles: Tile[], live: LiveDetection, ownerId: string): Meld[] {
  const ts = Date.now();
  return live.melds.map((m, i) => ({
    id: `${ownerId}-open-${ts}-${i}`,
    type: m.type,
    tiles: m.indices.map(idx => tiles[idx]).filter((t): t is Tile => t != null),
    ownerId,
  }));
}

// ── Auto-arrange: Seri Diz ────────────────────────────────────────────────
// Groups tiles into valid runs (same color, consecutive), maximizing coverage.

export function seriDiz(tiles: Tile[], indicator: IndicatorInfo): Tile[] {
  const wilds = tiles.filter(t => isMeldWildcard(t, indicator));
  const normals = tiles.filter(t => !isMeldWildcard(t, indicator));

  // Group by color, sort by number
  const byColor: Record<TileColor, Tile[]> = {
    red: [], blue: [], black: [], yellow: [],
  };
  for (const t of normals) {
    const c = runColor(t, indicator);
    if (c) byColor[c].push(t);
  }
  for (const col of Object.keys(byColor) as TileColor[]) {
    byColor[col].sort((a, b) => (runRank(a, indicator) ?? 0) - (runRank(b, indicator) ?? 0));
  }

  const runs: Tile[][] = [];
  const singles: Tile[] = [];
  let wildPool = [...wilds];

  for (const col of Object.keys(byColor) as TileColor[]) {
    const group = byColor[col];
    let i = 0;
    while (i < group.length) {
      const run: Tile[] = [group[i]];
      let expectedNext = (runRank(group[i], indicator) ?? 0) + 1;
      let j = i + 1;

      while (j < group.length || wildPool.length > 0) {
        const rj = j < group.length ? runRank(group[j], indicator) : null;
        if (rj === expectedNext) {
          run.push(group[j]);
          j++; expectedNext++;
        } else if (wildPool.length > 0 && expectedNext <= 13) {
          // Use wild to bridge a forward gap only (never when next tile rank < expected — duplicate rank).
          const nextReal = group[j] ? runRank(group[j], indicator) : undefined;
          if (
            nextReal != null
            && nextReal > expectedNext
            && nextReal - expectedNext <= wildPool.length
            && nextReal <= expectedNext + 2
          ) {
            run.push(wildPool.shift()!);
            expectedNext++;
          } else if (rj != null && rj < expectedNext) {
            // Aynı rank mükkerrebi (ör. 8,8) veya geride kalan taş: bu seriyi uzatmaz, sıradaki taşa geç.
            j++;
          } else {
            break;
          }
        } else if (rj != null && rj < expectedNext) {
          j++;
        } else {
          break;
        }
      }

      if (run.length >= 3) {
        runs.push(run);
      } else {
        singles.push(...run);
        // Return any wilds used
        const usedWilds = run.filter(t => isMeldWildcard(t, indicator));
        wildPool.push(...usedWilds);
      }
      i = j;
    }
  }

  // Sort runs: longest / most points first
  runs.sort((a, b) => meldPoints(b) - meldPoints(a));

  // Remaining wilds go with singles
  singles.push(...wildPool);
  const singlesSorted = sortSinglesSeri(singles, indicator);

  return [...runs.flat(), ...singlesSorted];
}

/** Same as seriDiz but inserts null gaps between meld groups and singles. */
export function seriDizWithGaps(tiles: Tile[], indicator: IndicatorInfo): (Tile | null)[] {
  const wilds = tiles.filter(t => isMeldWildcard(t, indicator));
  const normals = tiles.filter(t => !isMeldWildcard(t, indicator));

  const byColor: Record<TileColor, Tile[]> = {
    red: [], blue: [], black: [], yellow: [],
  };
  for (const t of normals) {
    const c = runColor(t, indicator);
    if (c) byColor[c].push(t);
  }
  for (const col of Object.keys(byColor) as TileColor[]) {
    byColor[col].sort((a, b) => (runRank(a, indicator) ?? 0) - (runRank(b, indicator) ?? 0));
  }

  const runs: Tile[][] = [];
  const singles: Tile[] = [];
  let wildPool = [...wilds];

  for (const col of Object.keys(byColor) as TileColor[]) {
    const group = byColor[col];
    let i = 0;
    while (i < group.length) {
      const run: Tile[] = [group[i]];
      let expectedNext = (runRank(group[i], indicator) ?? 0) + 1;
      let j = i + 1;

      while (j < group.length || wildPool.length > 0) {
        const rj = j < group.length ? runRank(group[j], indicator) : null;
        if (rj === expectedNext) {
          run.push(group[j]);
          j++; expectedNext++;
        } else if (wildPool.length > 0 && expectedNext <= 13) {
          const nextReal = group[j] ? runRank(group[j], indicator) : undefined;
          if (
            nextReal != null
            && nextReal > expectedNext
            && nextReal - expectedNext <= wildPool.length
            && nextReal <= expectedNext + 2
          ) {
            run.push(wildPool.shift()!);
            expectedNext++;
          } else if (rj != null && rj < expectedNext) {
            j++;
          } else {
            break;
          }
        } else if (rj != null && rj < expectedNext) {
          j++;
        } else {
          break;
        }
      }

      if (run.length >= 3) {
        runs.push(run);
      } else {
        singles.push(...run);
        const usedWilds = run.filter(t => isMeldWildcard(t, indicator));
        wildPool.push(...usedWilds);
      }
      i = j;
    }
  }

  runs.sort((a, b) => meldPoints(b) - meldPoints(a));
  singles.push(...wildPool);
  const singlesSorted = sortSinglesSeri(singles, indicator);

  return insertGaps(runs, singlesSorted);
}

// ── Auto-arrange: Çift Diz ────────────────────────────────────────────────
// Groups tiles into groups (same number, different colors) and pairs,
// maximizing coverage.

export function ciftDiz(tiles: Tile[], indicator: IndicatorInfo): Tile[] {
  const wilds = tiles.filter(t => isMeldWildcard(t, indicator));
  const normals = tiles.filter(t => !isMeldWildcard(t, indicator));

  // Group by number
  const byNumber = new Map<TileNumber, Tile[]>();
  for (const t of normals) {
    const n = runRank(t, indicator);
    if (n === null) continue;
    const arr = byNumber.get(n) ?? [];
    arr.push(t);
    byNumber.set(n, arr);
  }

  const groups4: Tile[][] = [];
  const groups3: Tile[][] = [];
  const pairs: Tile[][] = [];
  const singles: Tile[] = [];
  let wildPool = [...wilds];

  // Sort numbers descending (higher value groups first)
  const sortedNums = [...byNumber.keys()].sort((a, b) => b - a);

  for (const num of sortedNums) {
    const bucket = byNumber.get(num)!;
    // Deduplicate: group by unique colors first
    const colorMap = new Map<TileColor, Tile[]>();
    for (const t of bucket) {
      const col = runColor(t, indicator)!;
      const arr = colorMap.get(col) ?? [];
      arr.push(t);
      colorMap.set(col, arr);
    }
    const uniqueColors = [...colorMap.keys()];
    const groupTiles = uniqueColors.map(c => colorMap.get(c)![0]); // one per color

    if (groupTiles.length === 4) {
      groups4.push(groupTiles);
      // remaining same-color copies become pairs/singles
      for (const [col, arr] of colorMap) {
        if (arr.length > 1) pairs.push(arr.slice(1));
      }
    } else if (groupTiles.length === 3) {
      // Try to complete to 4 with a wild
      if (wildPool.length > 0) {
        groups4.push([...groupTiles, wildPool.shift()!]);
        for (const [col, arr] of colorMap) {
          if (arr.length > 1) singles.push(...arr.slice(1));
        }
      } else {
        groups3.push(groupTiles);
        for (const [col, arr] of colorMap) {
          if (arr.length > 1) pairs.push(arr.slice(1));
        }
      }
    } else if (groupTiles.length === 2) {
      if (wildPool.length > 0) {
        groups3.push([...groupTiles, wildPool.shift()!]);
        for (const [col, arr] of colorMap) {
          if (arr.length > 1) singles.push(...arr.slice(1));
        }
      } else {
        // Keep as pairs if same-color duplicates
        for (const arr of colorMap.values()) {
          if (arr.length >= 2) pairs.push([arr[0], arr[1]]);
          else singles.push(arr[0]);
        }
      }
    } else {
      for (const arr of colorMap.values()) {
        if (arr.length >= 2) pairs.push([arr[0], arr[1]]);
        singles.push(...arr.slice(2));
      }
    }
  }

  singles.push(...wildPool);
  singles.sort((a, b) => {
    const na = runRank(a, indicator);
    const nb = runRank(b, indicator);
    if (na === null && nb === null) return 0;
    if (na === null) return 1;
    if (nb === null) return -1;
    return nb - na;
  });

  return [...groups4.flat(), ...groups3.flat(), ...pairs.flat(), ...singles];
}

/** Same as ciftDiz but inserts null gaps between meld groups and singles. */
export function ciftDizWithGaps(tiles: Tile[], indicator: IndicatorInfo): (Tile | null)[] {
  const wilds = tiles.filter(t => isMeldWildcard(t, indicator));
  const normals = tiles.filter(t => !isMeldWildcard(t, indicator));

  const byNumber = new Map<TileNumber, Tile[]>();
  for (const t of normals) {
    const n = runRank(t, indicator);
    if (n === null) continue;
    const arr = byNumber.get(n) ?? [];
    arr.push(t);
    byNumber.set(n, arr);
  }

  const groups4: Tile[][] = [];
  const groups3: Tile[][] = [];
  const pairs: Tile[][] = [];
  const singles: Tile[] = [];
  let wildPool = [...wilds];

  const sortedNums = [...byNumber.keys()].sort((a, b) => b - a);

  for (const num of sortedNums) {
    const bucket = byNumber.get(num)!;
    const colorMap = new Map<TileColor, Tile[]>();
    for (const t of bucket) {
      const col = runColor(t, indicator)!;
      const arr = colorMap.get(col) ?? [];
      arr.push(t);
      colorMap.set(col, arr);
    }
    const uniqueColors = [...colorMap.keys()];
    const groupTiles = uniqueColors.map(c => colorMap.get(c)![0]);

    if (groupTiles.length === 4) {
      groups4.push(groupTiles);
      for (const [, arr] of colorMap) { if (arr.length > 1) pairs.push(arr.slice(1)); }
    } else if (groupTiles.length === 3) {
      if (wildPool.length > 0) {
        groups4.push([...groupTiles, wildPool.shift()!]);
        for (const [, arr] of colorMap) { if (arr.length > 1) singles.push(...arr.slice(1)); }
      } else {
        groups3.push(groupTiles);
        for (const [, arr] of colorMap) { if (arr.length > 1) pairs.push(arr.slice(1)); }
      }
    } else if (groupTiles.length === 2) {
      if (wildPool.length > 0) {
        groups3.push([...groupTiles, wildPool.shift()!]);
        for (const [, arr] of colorMap) { if (arr.length > 1) singles.push(...arr.slice(1)); }
      } else {
        for (const arr of colorMap.values()) {
          if (arr.length >= 2) pairs.push([arr[0], arr[1]]);
          else singles.push(arr[0]);
        }
      }
    } else {
      for (const arr of colorMap.values()) {
        if (arr.length >= 2) pairs.push([arr[0], arr[1]]);
        singles.push(...arr.slice(2));
      }
    }
  }

  singles.push(...wildPool);
  singles.sort((a, b) => {
    const na = runRank(a, indicator);
    const nb = runRank(b, indicator);
    if (na === null && nb === null) return 0;
    if (na === null) return 1;
    if (nb === null) return -1;
    return nb - na;
  });

  const allGroups = [...groups4, ...groups3, ...pairs.filter(p => p.length >= 2)];
  const pairSingles = pairs.filter(p => p.length < 2).flat();

  return insertGaps(allGroups, [...pairSingles, ...singles]);
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

/** Convert a flat (Tile | null)[] with gaps into a 2-row grid. */
export function tilesToGrid(items: (Tile | null)[], cols: number): (Tile | null)[][] {
  const row1: (Tile | null)[] = [];
  const row2: (Tile | null)[] = [];

  for (let i = 0; i < items.length; i++) {
    if (row1.length < cols) {
      row1.push(items[i]);
    } else {
      row2.push(items[i]);
    }
  }

  while (row1.length < cols) row1.push(null);
  while (row2.length < cols) row2.push(null);

  return [row1, row2];
}

/** Convert a 2-row grid back into a flat tile array (no nulls). */
export function gridToTiles(grid: (Tile | null)[][]): Tile[] {
  return grid.flat().filter((t): t is Tile => t !== null);
}
