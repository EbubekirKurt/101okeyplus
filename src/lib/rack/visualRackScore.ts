import { IndicatorInfo } from '../../types/game';
import { Tile } from '../../types/tile';
import { detectLiveMelds } from '../auto-arrange';
import {
  detectMeldType,
  meldPoints,
  validateNPairs,
} from '../melds/validateMeld';

export const RACK_ROWS = 2;
export const RACK_COLS = 15;

export function normalizeRackGrid(g: (Tile | null)[][]): (Tile | null)[][] {
  const out: (Tile | null)[][] = [[], []];
  for (let r = 0; r < RACK_ROWS; r++) {
    const row = g[r] ?? [];
    for (let c = 0; c < RACK_COLS; c++) {
      out[r][c] = row[c] ?? null;
    }
  }
  return out;
}

/**
 * Grid'i satır-satır düzleştir: üst satırın sonunda null yoksa ve
 * alt satırın başında null yoksa, ikisi aynı segment olarak devam eder.
 * Böylece sıra taşması yüzünden bölünen perler tek parça kalır.
 */
function gridToFlatCells(g: (Tile | null)[][]): (Tile | null)[] {
  const flat: (Tile | null)[] = [];
  for (let r = 0; r < RACK_ROWS; r++) {
    for (let c = 0; c < RACK_COLS; c++) {
      flat.push(g[r]?.[c] ?? null);
    }
  }
  return flat;
}

function scoreSegment(
  seg: Tile[],
  indicator: IndicatorInfo,
  out: {
    seriesPoints: number;
    pairSegmentCount: number;
    meldsForOpen: Array<{ tiles: Tile[]; type: 'run' | 'group' }>;
    meldGroupByTileId: Map<string, number>;
    groupIdx: number;
  },
) {
  if (seg.length >= 3) {
    const t = detectMeldType(seg, indicator);
    if (t) {
      out.seriesPoints += meldPoints(seg, indicator, t);
      out.meldsForOpen.push({ tiles: [...seg], type: t });
      for (const tile of seg) out.meldGroupByTileId.set(tile.id, out.groupIdx);
      out.groupIdx++;
    } else {
      const live = detectLiveMelds(seg, indicator);
      if (live.totalPoints > 0) {
        out.seriesPoints += live.totalPoints;
        for (const m of live.melds) {
          const tiles = m.indices.map(i => seg[i]).filter((x): x is Tile => x != null);
          out.meldsForOpen.push({ tiles, type: m.type });
          for (const tile of tiles) out.meldGroupByTileId.set(tile.id, out.groupIdx);
          out.groupIdx++;
        }
      }
    }
  } else if (seg.length === 2 && validateNPairs(seg, indicator, 1)) {
    out.pairSegmentCount++;
  }
}

/**
 * Istakada bitişik taşları segment olarak toplar (null = ayırıcı).
 * Üst satırın sonu → alt satırın başı null-free ise aynı segment devam eder.
 */
export function scoreVisualRack(
  grid: (Tile | null)[][],
  indicator: IndicatorInfo,
): {
  seriesPoints: number;
  pairSegmentCount: number;
  meldsForOpen: Array<{ tiles: Tile[]; type: 'run' | 'group' }>;
  meldGroupByTileId: Map<string, number>;
} {
  const g = normalizeRackGrid(grid);
  const flat = gridToFlatCells(g);

  const out = {
    seriesPoints: 0,
    pairSegmentCount: 0,
    meldsForOpen: [] as Array<{ tiles: Tile[]; type: 'run' | 'group' }>,
    meldGroupByTileId: new Map<string, number>(),
    groupIdx: 0,
  };

  let i = 0;
  while (i < flat.length) {
    while (i < flat.length && flat[i] == null) i++;
    if (i >= flat.length) break;
    const seg: Tile[] = [];
    while (i < flat.length && flat[i] != null) {
      seg.push(flat[i]!);
      i++;
    }
    scoreSegment(seg, indicator, out);
  }

  return {
    seriesPoints: out.seriesPoints,
    pairSegmentCount: out.pairSegmentCount,
    meldsForOpen: out.meldsForOpen,
    meldGroupByTileId: out.meldGroupByTileId,
  };
}
