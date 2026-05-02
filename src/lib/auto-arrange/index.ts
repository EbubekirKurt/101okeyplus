import { IndicatorInfo } from '../../types/game';
import { Tile, TileColor, TileNumber } from '../../types/tile';
import { isOkey } from '../tiles/okey';

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

function tileNum(t: Tile): TileNumber | null {
  return t.kind === 'numbered' ? t.number : null;
}
function tileColor(t: Tile): TileColor | null {
  return t.kind === 'numbered' ? t.color : null;
}
function meldPoints(tiles: Tile[]): number {
  return tiles.reduce((s, t) => s + (t.kind === 'numbered' ? t.number : 30), 0);
}

// ── Live detection: scan ordered hand for valid melds ─────────────────────
// Greedy left-to-right: finds the best non-overlapping melds in current order.

export function detectLiveMelds(tiles: Tile[], indicator: IndicatorInfo): LiveDetection {
  const used = new Set<number>();
  const melds: DetectedMeld[] = [];

  // Try runs first (same color, consecutive), then groups
  for (let start = 0; start < tiles.length; start++) {
    if (used.has(start)) continue;

    // --- Try run starting at `start` ---
    const runIndices: number[] = [start];
    const t0 = tiles[start];
    const color0 = isOkey(t0, indicator) ? null : tileColor(t0);

    for (let j = start + 1; j < tiles.length && runIndices.length < 13; j++) {
      if (used.has(j)) break;
      const tj = tiles[j];
      const wild = isOkey(tj, indicator) || tj.kind === 'fake-joker';

      if (wild) {
        runIndices.push(j);
        continue;
      }

      const cj = tileColor(tj);
      const nj = tileNum(tj);
      if (!cj || !nj) break;

      // Establish color from first real tile
      const effectiveColor = color0 ?? cj;
      if (cj !== effectiveColor) break;

      // Check consecutive with last real tile in run
      const lastReal = [...runIndices].reverse().find(i => {
        const t = tiles[i];
        return !isOkey(t, indicator) && t.kind !== 'fake-joker';
      });
      if (lastReal === undefined) { runIndices.push(j); continue; }
      const lastNum = tileNum(tiles[lastReal])!;
      const gapAllowed = runIndices.length - (lastReal === runIndices[runIndices.length - 1] ? 0 : 1);
      // Simple: only extend if next number is lastNum+1 (wildcards fill gaps handled below)
      if (nj === lastNum + 1) {
        runIndices.push(j);
      } else {
        break;
      }
    }

    if (runIndices.length >= 3) {
      const pts = meldPoints(runIndices.map(i => tiles[i]));
      melds.push({ indices: [...runIndices], type: 'run', points: pts });
      runIndices.forEach(i => used.add(i));
      continue;
    }

    // --- Try group starting at `start` (same number, different colors) ---
    const n0 = isOkey(t0, indicator) ? null : tileNum(t0);
    const groupIndices: number[] = [start];
    const groupColors = new Set<TileColor>(color0 ? [color0] : []);

    for (let j = start + 1; j < tiles.length && groupIndices.length < 4; j++) {
      if (used.has(j)) break;
      const tj = tiles[j];
      const wild = isOkey(tj, indicator) || tj.kind === 'fake-joker';

      if (wild) { groupIndices.push(j); continue; }

      const nj = tileNum(tj);
      const cj = tileColor(tj);
      if (!nj || !cj) break;

      const effectiveNum = n0 ?? nj;
      if (nj !== effectiveNum) break;
      if (groupColors.has(cj)) break;

      groupColors.add(cj);
      groupIndices.push(j);
    }

    if (groupIndices.length >= 3) {
      const pts = meldPoints(groupIndices.map(i => tiles[i]));
      melds.push({ indices: [...groupIndices], type: 'group', points: pts });
      groupIndices.forEach(i => used.add(i));
    }
  }

  return {
    melds,
    meldedIndices: used,
    totalPoints: melds.reduce((s, m) => s + m.points, 0),
  };
}

// ── Auto-arrange: Seri Diz ────────────────────────────────────────────────
// Groups tiles into valid runs (same color, consecutive), maximizing coverage.

export function seriDiz(tiles: Tile[], indicator: IndicatorInfo): Tile[] {
  const wilds = tiles.filter(t => isOkey(t, indicator) || t.kind === 'fake-joker');
  const normals = tiles.filter(t => !isOkey(t, indicator) && t.kind !== 'fake-joker') as Extract<Tile, { kind: 'numbered' }>[];

  // Group by color, sort by number
  const byColor: Record<TileColor, Extract<Tile, { kind: 'numbered' }>[]> = {
    red: [], blue: [], black: [], yellow: [],
  };
  for (const t of normals) byColor[t.color].push(t);
  for (const col of Object.keys(byColor) as TileColor[]) {
    byColor[col].sort((a, b) => a.number - b.number);
  }

  const runs: Tile[][] = [];
  const singles: Tile[] = [];
  let wildPool = [...wilds];

  for (const col of Object.keys(byColor) as TileColor[]) {
    const group = byColor[col];
    let i = 0;
    while (i < group.length) {
      const run: Tile[] = [group[i]];
      let expectedNext = group[i].number + 1;
      let j = i + 1;

      while (j < group.length || wildPool.length > 0) {
        if (j < group.length && group[j].number === expectedNext) {
          run.push(group[j]);
          j++; expectedNext++;
        } else if (wildPool.length > 0 && expectedNext <= 13) {
          // Use wild to bridge gap if next real tile is close enough
          const nextReal = group[j]?.number;
          if (nextReal && nextReal - expectedNext <= wildPool.length && nextReal <= expectedNext + 2) {
            run.push(wildPool.shift()!);
            expectedNext++;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      if (run.length >= 3) {
        runs.push(run);
      } else {
        singles.push(...run);
        // Return any wilds used
        const usedWilds = run.filter(t => isOkey(t, indicator) || t.kind === 'fake-joker');
        wildPool.push(...usedWilds);
      }
      i = j;
    }
  }

  // Sort runs: longest / most points first
  runs.sort((a, b) => meldPoints(b) - meldPoints(a));

  // Remaining wilds go with singles
  singles.push(...wildPool);
  singles.sort((a, b) => {
    if (a.kind !== 'numbered' || b.kind !== 'numbered') return 0;
    return b.number - a.number;
  });

  return [...runs.flat(), ...singles];
}

// ── Auto-arrange: Çift Diz ────────────────────────────────────────────────
// Groups tiles into groups (same number, different colors) and pairs,
// maximizing coverage.

export function ciftDiz(tiles: Tile[], indicator: IndicatorInfo): Tile[] {
  const wilds = tiles.filter(t => isOkey(t, indicator) || t.kind === 'fake-joker');
  const normals = tiles.filter(t => !isOkey(t, indicator) && t.kind !== 'fake-joker') as Extract<Tile, { kind: 'numbered' }>[];

  // Group by number
  const byNumber = new Map<TileNumber, Extract<Tile, { kind: 'numbered' }>[]>();
  for (const t of normals) {
    const arr = byNumber.get(t.number) ?? [];
    arr.push(t);
    byNumber.set(t.number, arr);
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
      const arr = colorMap.get(t.color) ?? [];
      arr.push(t);
      colorMap.set(t.color, arr);
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
    if (a.kind !== 'numbered' || b.kind !== 'numbered') return 0;
    return b.number - a.number;
  });

  return [...groups4.flat(), ...groups3.flat(), ...pairs.flat(), ...singles];
}
