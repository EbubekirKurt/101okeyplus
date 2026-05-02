import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, closestCorners,
  useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IndicatorInfo } from '../../types/game';
import { Tile } from '../../types/tile';
import { repairHandTileIds } from '../../lib/tiles/repairTileIds';
import { isOkey } from '../../lib/tiles/okey';
import { TileComponent } from '../tile/Tile';

const COLS = 15;
const ROWS = 2;
const CELL_H = 80;
/** md taş genişliği + hücre payı (Tile.tsx SIZE.md) */
const SLOT_W = 58;
const OWN_DISCARD_DROP_ID = 'own-discard-drop';
const SIDE_SLOT_W = 108;
/** Per ve çift vurgusu — tüm geçerli bloklar aynı yeşil. */
const RACK_MELD_ACCENT = '#22c55e';

type GridCell = Tile | null;
type Grid = GridCell[][];

function emptyGrid(): Grid {
  return [
    Array(COLS).fill(null),
    Array(COLS).fill(null),
  ];
}

function tilesToGridInit(tiles: Tile[]): Grid {
  const grid = emptyGrid();
  let idx = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (idx < tiles.length) {
        grid[r][c] = tiles[idx++];
      }
    }
  }
  return grid;
}

function gridToTilesFlat(grid: Grid): Tile[] {
  return grid.flat().filter((t): t is Tile => t !== null);
}

function parseRackDragId(id: string): { row: number; col: number } | null {
  const m = String(id).match(/^rack-(\d+)-(\d+)$/);
  if (!m) return null;
  return { row: parseInt(m[1], 10), col: parseInt(m[2], 10) };
}

function findTileInGrid(grid: Grid, tileId: string): [number, number] | null {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c]?.id === tileId) return [r, c];
    }
  }
  return null;
}

function canPlaceGroup(grid: Grid, row: number, startCol: number, count: number, excludeIds: Set<string>): boolean {
  if (startCol + count > COLS) return false;
  for (let c = startCol; c < startCol + count; c++) {
    const cell = grid[row][c];
    if (cell !== null && !excludeIds.has(cell.id)) return false;
  }
  return true;
}

function mergeNewTilesIntoGrid(prev: Grid, tiles: Tile[]): Grid {
  const repaired = repairHandTileIds(tiles);
  const tileById = new Map(repaired.map(t => [t.id, t]));

  // Grid'deki taşlardan hâlâ elde olanları koru, olmayanları sil
  const kept = new Set<string>();
  const result: Grid = prev.map(row => row.map(cell => {
    if (cell && tileById.has(cell.id)) {
      kept.add(cell.id);
      return tileById.get(cell.id)!;
    }
    return null;
  }));

  // Elde olup grid'de olmayan taşları son müsait kareye koy
  const missing = repaired.filter(t => !kept.has(t.id));
  for (const tile of missing) {
    let placed = false;
    for (let r = ROWS - 1; r >= 0 && !placed; r--) {
      for (let c = COLS - 1; c >= 0 && !placed; c--) {
        if (result[r][c] === null) {
          result[r][c] = tile;
          placed = true;
        }
      }
    }
  }

  const onGrid = gridToTilesFlat(result).length;
  if (onGrid !== repaired.length) {
    if (import.meta.env.DEV) {
      console.warn('[mergeNewTilesIntoGrid] taş sayısı uyuşmuyor, ıstaka sıfırlanıyor', {
        onGrid,
        expected: repaired.length,
      });
    }
    return tilesToGridInit(repaired);
  }
  return result;
}

// ── Sol rakip: alınabilir üst taş / soldan aldıktan sonra geri ver + önceki atış ─

function LeftDiscardSlot({
  indicator,
  neighborName,
  pileTopTile,
  canPickFromPile,
  onPickFromPile,
  mustRespondToLeftPick,
  pickedFromLeftTile,
  canReturnPicked,
  onReturnPicked,
}: {
  indicator: IndicatorInfo | null;
  neighborName?: string;
  pileTopTile: Tile | null;
  canPickFromPile: boolean;
  onPickFromPile?: () => void;
  mustRespondToLeftPick: boolean;
  pickedFromLeftTile: Tile | null;
  canReturnPicked: boolean;
  onReturnPicked?: () => void;
}) {
  const borderColor = mustRespondToLeftPick
    ? 'rgba(251,146,60,0.55)'
    : canPickFromPile ? 'rgba(250,204,21,0.55)' : 'rgba(255,255,255,0.12)';
  const bg = mustRespondToLeftPick
    ? 'rgba(124,45,18,0.35)'
    : canPickFromPile ? 'rgba(250,204,21,0.08)' : 'rgba(0,0,0,0.25)';

  if (mustRespondToLeftPick) {
    return (
      <div style={{
        flexShrink: 0,
        width: SIDE_SLOT_W,
        borderRadius: 10,
        border: `2px solid ${borderColor}`,
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 4,
        padding: 8,
        color: 'rgba(255,255,255,0.88)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', opacity: 0.9 }}>Soldan aldın</span>
        {neighborName && (
          <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.55, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{neighborName}</span>
        )}
        {pickedFromLeftTile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(253,224,71,0.85)' }}>İade (aynı taş)</span>
            <TileComponent tile={pickedFromLeftTile} indicator={indicator} size="md" />
          </div>
        )}
        {pileTopTile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.65 }}>Rakipte üstte</span>
            <TileComponent tile={pileTopTile} indicator={indicator} size="md" />
          </div>
        )}
        <button
          type="button"
          disabled={!canReturnPicked}
          onClick={() => canReturnPicked && onReturnPicked?.()}
          style={{
            marginTop: 'auto',
            width: '100%',
            padding: '6px 4px',
            borderRadius: 8,
            border: '1px solid rgba(251,146,60,0.45)',
            background: canReturnPicked ? 'rgba(251,146,60,0.25)' : 'rgba(0,0,0,0.2)',
            color: canReturnPicked ? 'white' : 'rgba(255,255,255,0.35)',
            fontSize: 13,
            fontWeight: 800,
            cursor: canReturnPicked ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 14 }} aria-hidden>↩</span>
          Geri ver
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!canPickFromPile}
      onClick={() => canPickFromPile && onPickFromPile?.()}
      style={{
        flexShrink: 0,
        width: SIDE_SLOT_W,
        minHeight: CELL_H * ROWS + 12,
        borderRadius: 10,
        border: `2px solid ${borderColor}`,
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: 6,
        cursor: canPickFromPile ? 'pointer' : 'default',
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.85 }}>Soldan</span>
      {neighborName && (
        <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.55, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{neighborName}</span>
      )}
      {pileTopTile ? (
        <TileComponent tile={pileTopTile} indicator={indicator} size="md" />
      ) : (
        <div style={{
          width: 42, height: 60, borderRadius: 8,
          border: '1px dashed rgba(255,255,255,0.2)',
          background: 'rgba(0,0,0,0.15)',
        }} />
      )}
      {canPickFromPile && <span style={{ fontSize: 11, fontWeight: 700, color: '#facc15' }}>Al</span>}
    </button>
  );
}

// ── Kendi atığın taş (sürükleyerek at) — her zaman görünür ─────────────────

function OwnDiscardDropZone({
  indicator,
  lastTile,
  dropEnabled,
}: {
  indicator: IndicatorInfo | null;
  lastTile: Tile | null;
  dropEnabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: OWN_DISCARD_DROP_ID,
    disabled: !dropEnabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        flexShrink: 0,
        width: SIDE_SLOT_W,
        minHeight: CELL_H * ROWS + 16,
        borderRadius: 10,
        border: `2px dashed ${dropEnabled && isOver ? 'rgba(250,204,21,0.9)' : dropEnabled ? 'rgba(252,165,165,0.45)' : 'rgba(255,255,255,0.12)'}`,
        background: dropEnabled && isOver ? 'rgba(250,204,21,0.12)' : 'rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: 6,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.85 }}>Attığın</span>
      {lastTile ? (
        <TileComponent tile={lastTile} indicator={indicator} size="md" />
      ) : (
        <span style={{ color: 'rgba(252,165,165,0.45)', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>—</span>
      )}
      <span style={{ color: dropEnabled ? 'rgba(252,165,165,0.75)' : 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: 600 }}>
        {dropEnabled ? '↑ bırak' : 'sıra değil'}
      </span>
    </div>
  );
}

// ── Droppable Slot ──────────────────────────────────────────────────────────

function SlotCell({ row, col, isOver, children }: {
  row: number; col: number; isOver?: boolean; children?: React.ReactNode;
}) {
  const { setNodeRef, isOver: slotIsOver } = useDroppable({ id: `slot-${row}-${col}` });
  const active = isOver || slotIsOver;

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: `0 0 ${SLOT_W}px`,
        width: SLOT_W,
        height: CELL_H,
        borderRadius: 4,
        border: active ? '2px dashed rgba(250,204,21,0.6)' : '1px solid rgba(255,255,255,0.04)',
        background: active ? 'rgba(250,204,21,0.1)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'border-color 0.15s, background 0.15s',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

// ── Draggable Tile ──────────────────────────────────────────────────────────

function DraggableTileCell({ row, col, tile, indicator, selected, onSelect, meldGroup, isDragOverlay }: {
  row: number;
  col: number;
  tile: Tile;
  indicator: IndicatorInfo | null;
  selected: boolean;
  onSelect: () => void;
  meldGroup?: number;
  isDragOverlay?: boolean;
}) {
  /** Rack slot id — unique per cell so two okey tiles (same face, different copy) never collide in @dnd-kit. */
  const dragId = `rack-${row}-${col}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { row, col, tileId: tile.id },
  });
  const color = meldGroup !== undefined ? RACK_MELD_ACCENT : undefined;

  const style: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.25 : 1,
    zIndex: isDragging ? 100 : 1,
    position: 'relative',
    cursor: 'grab',
    touchAction: 'none',
  };

  if (isDragOverlay) {
    return (
      <div style={{ position: 'relative' }}>
        <TileComponent tile={tile} indicator={indicator} selected={selected} dragging size="md" disableSharedLayout />
        {color && (
          <div style={{
            position: 'absolute', bottom: -1, left: 0, right: 0, height: 4,
            background: color,
            borderRadius: '0 0 6px 6px',
            boxShadow: `0 0 12px ${color}, 0 0 6px ${color}, 0 2px 10px rgba(34,197,94,0.55)`,
          }} />
        )}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TileComponent
        tile={tile}
        indicator={indicator}
        selected={selected}
        onClick={onSelect}
        dragging={isDragging}
        size="md"
        disableSharedLayout
        suppressMicroMotion
      />
      {color && (
        <div style={{
          position: 'absolute', bottom: -1, left: 0, right: 0, height: 4,
          background: color,
          borderRadius: '0 0 6px 6px',
          boxShadow: `0 0 12px ${color}, 0 0 6px ${color}, 0 2px 10px rgba(34,197,94,0.55)`,
        }} />
      )}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface PlayerHandProps {
  tiles: Tile[];
  indicator: IndicatorInfo | null;
  selectedIds: Set<string>;
  onTileTap: (id: string) => void;
  onReorder: (tiles: Tile[]) => void;
  meldGroupByTileId?: Map<string, number>;
  gridOverride?: (Tile | null)[][] | null;
  /** Her grid güncellemesinde (boşluklar dahil) üst bileşene iletilir — Seriler/Çiftler ıstaka düzenine göre hesaplanır. */
  onRackGridSync?: (grid: (Tile | null)[][]) => void;
  /** Hide these tile ids in the rack (e.g. while bank-draw flight overlay is showing). */
  hiddenTileIds?: Set<string>;
  canDiscard?: boolean;
  lastOwnDiscard?: Tile | null;
  onDiscardToPile?: (tileId: string) => void;
  /** Sol rakip alanı — ıstakanın solunda (4 oyunda sol rakip varken). */
  showLeftDiscardSlot?: boolean;
  leftNeighborName?: string;
  leftPileTopTile?: Tile | null;
  canPickLeftDiscard?: boolean;
  onPickLeftDiscard?: () => void;
  mustRespondToLeftPick?: boolean;
  pickedFromLeftTile?: Tile | null;
  canReturnLeftPick?: boolean;
  onReturnLeftPick?: () => void;
}

export function PlayerHand({
  tiles,
  indicator,
  selectedIds,
  onTileTap,
  onReorder,
  meldGroupByTileId,
  gridOverride,
  onRackGridSync,
  hiddenTileIds,
  canDiscard,
  lastOwnDiscard,
  onDiscardToPile,
  showLeftDiscardSlot,
  leftNeighborName,
  leftPileTopTile,
  canPickLeftDiscard,
  onPickLeftDiscard,
  mustRespondToLeftPick,
  pickedFromLeftTile,
  canReturnLeftPick,
  onReturnLeftPick,
}: PlayerHandProps) {
  const [grid, setGrid] = useState<Grid>(() => tilesToGridInit(tiles));
  const [activeId, setActiveId] = useState<string | null>(null);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const prevSortedIdsRef = useRef<string>('');
  const prevOrderedIdsRef = useRef<string>('');

  const pushParentOrderIfNeeded = useCallback((nextGrid: Grid, tilesProp: Tile[]) => {
    const flat = gridToTilesFlat(nextGrid).map(t => t.id).join(',');
    const prop = tilesProp.map(t => t.id).join(',');
    if (flat !== prop) {
      queueMicrotask(() => onReorder(gridToTilesFlat(nextGrid)));
    }
  }, [onReorder]);

  // Sync grid with tiles: multiset change (draw/discard) vs order-only (parent reorder)
  useEffect(() => {
    const sorted = [...tiles].map(t => t.id).sort().join(',');
    const ordered = tiles.map(t => t.id).join(',');

    if (sorted !== prevSortedIdsRef.current) {
      let merged: Grid | null = null;
      setGrid(prev => {
        merged = mergeNewTilesIntoGrid(prev, tiles);
        pushParentOrderIfNeeded(merged, tiles);
        return merged;
      });
      if (merged) {
        prevSortedIdsRef.current = sorted;
        prevOrderedIdsRef.current = gridToTilesFlat(merged).map(t => t.id).join(',');
      }
      return;
    }

    if (ordered !== prevOrderedIdsRef.current) {
      prevOrderedIdsRef.current = ordered;
      // Sürükle-bıraktan sonra grid zaten doğru sıradaysa tilesToGridInit ile bozma
      setGrid(g => {
        const flat = gridToTilesFlat(g).map(t => t.id).join(',');
        if (flat === ordered) return g;
        return tilesToGridInit(tiles);
      });
    }
  }, [tiles, onReorder, pushParentOrderIfNeeded]);

  // Accept grid override from auto-arrange
  useEffect(() => {
    if (!gridOverride) return;
    const padded: Grid = gridOverride.map(row => {
      const r = [...row];
      while (r.length < COLS) r.push(null);
      return r.slice(0, COLS);
    });
    while (padded.length < ROWS) padded.push(Array(COLS).fill(null));
    const flat = gridToTilesFlat(padded);
    prevSortedIdsRef.current = flat.map(t => t.id).sort().join(',');
    prevOrderedIdsRef.current = flat.map(t => t.id).join(',');
    queueMicrotask(() => { setGrid(padded); });
  }, [gridOverride]);

  useEffect(() => {
    onRackGridSync?.(grid);
  }, [grid, onRackGridSync]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function onDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function onDragEnd(e: DragEndEvent) {
    const overId = e.over?.id as string | undefined;
    const dist = Math.hypot(e.delta.x, e.delta.y);
    const fromData = e.active.data.current as { row?: number; col?: number } | undefined;
    const parsed = parseRackDragId(String(e.active.id));
    const start = fromData != null && typeof fromData.row === 'number' && typeof fromData.col === 'number'
      ? { row: fromData.row, col: fromData.col }
      : parsed;
    setActiveId(null);

    if (!start) return;

    if (overId === OWN_DISCARD_DROP_ID && canDiscard && onDiscardToPile) {
      const t = gridRef.current[start.row]?.[start.col];
      if (t) onDiscardToPile(t.id);
      return;
    }

    if (!overId) return;

    // Treat tiny movement as a click, not a drag — avoids accidental grid mutations / lost tiles
    if (dist < 10) return;

    // Parse target slot
    const match = overId.match(/^slot-(\d+)-(\d+)$/);
    if (!match) return;

    const targetRow = parseInt(match[1]);
    const targetCol = parseInt(match[2]);

    setGrid(prev => {
      const tile = prev[start.row]?.[start.col];
      if (!tile) return prev;
      const endedId = tile.id;
      const groupIds = [endedId];

      const next: Grid = prev.map(row => [...row]);
      const excludeIds = new Set(groupIds);

      if (start.row === targetRow && start.col === targetCol && groupIds.length === 1) {
        return prev;
      }

      // Collect group tiles in grid order (single-tile drag uses start cell so duplicate tile.id never resolves wrong)
      const groupTiles: { tile: Tile; row: number; col: number }[] = [];
      if (groupIds.length === 1) {
        const t0 = next[start.row][start.col];
        if (t0) groupTiles.push({ tile: t0, row: start.row, col: start.col });
      } else {
        for (const gid of groupIds) {
          const pos = findTileInGrid(next, gid);
          if (pos) {
            groupTiles.push({ tile: next[pos[0]][pos[1]]!, row: pos[0], col: pos[1] });
          }
        }
      }

      // Sort by row then col to preserve relative order
      groupTiles.sort((a, b) => a.row === b.row ? a.col - b.col : a.row - b.row);

      if (groupTiles.length === 0) return prev;

      // For a group, find the offset of the dragged tile within the group
      const draggedIdx = groupTiles.findIndex(gt => gt.tile.id === endedId);
      const startCol = Math.max(0, Math.min(COLS - groupTiles.length, targetCol - draggedIdx));

      // Check if placement is possible
      if (!canPlaceGroup(next, targetRow, startCol, groupTiles.length, excludeIds)) {
        // Try without offset adjustment
        const altStart = Math.max(0, Math.min(COLS - groupTiles.length, targetCol));
        if (!canPlaceGroup(next, targetRow, altStart, groupTiles.length, excludeIds)) {
          return prev; // Can't place, revert
        }
        // Clear old positions
        for (const gt of groupTiles) next[gt.row][gt.col] = null;
        // Place at alt position
        for (let i = 0; i < groupTiles.length; i++) {
          next[targetRow][altStart + i] = groupTiles[i].tile;
        }
      } else {
        // Clear old positions
        for (const gt of groupTiles) next[gt.row][gt.col] = null;
        // Place group starting at computed position
        for (let i = 0; i < groupTiles.length; i++) {
          next[targetRow][startCol + i] = groupTiles[i].tile;
        }
      }

      setTimeout(() => onReorder(gridToTilesFlat(next)), 0);
      return next;
    });
  }

  const activeSlot = useMemo(() => {
    if (!activeId) return null;
    const m = activeId.match(/^rack-(\d+)-(\d+)$/);
    if (!m) return null;
    return { row: parseInt(m[1], 10), col: parseInt(m[2], 10) };
  }, [activeId]);

  const activeTile = activeSlot ? grid[activeSlot.row]?.[activeSlot.col] ?? null : null;

  const dropToOwnPileEnabled = Boolean(canDiscard && onDiscardToPile);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, width: '100%', minWidth: 0 }}>
        {showLeftDiscardSlot && (
          <LeftDiscardSlot
            indicator={indicator}
            neighborName={leftNeighborName}
            pileTopTile={leftPileTopTile ?? null}
            canPickFromPile={Boolean(canPickLeftDiscard && onPickLeftDiscard && !mustRespondToLeftPick)}
            onPickFromPile={onPickLeftDiscard}
            mustRespondToLeftPick={Boolean(mustRespondToLeftPick)}
            pickedFromLeftTile={pickedFromLeftTile ?? null}
            canReturnPicked={Boolean(canReturnLeftPick && onReturnLeftPick)}
            onReturnPicked={onReturnLeftPick}
          />
        )}
        {/* Rack frame — satır genişliğini doldurur */}
        <div style={{
          flex: 1,
          minWidth: 0,
          border: '3px solid #6b4423',
          borderRadius: 10,
          background: 'linear-gradient(180deg, rgba(139,94,48,0.3) 0%, rgba(93,58,24,0.2) 100%)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
          padding: '6px 6px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            {grid.map((row, ri) => (
              <div key={ri} style={{ position: 'relative', width: '100%' }}>
                <div style={{
                  display: 'flex',
                  gap: 1,
                  minHeight: CELL_H,
                  width: '100%',
                  justifyContent: 'center',
                  flexWrap: 'nowrap',
                  overflowX: 'auto',
                }}>
                  {row.map((cell, ci) => {
                    const isDraggedAway = Boolean(cell && activeSlot && activeSlot.row === ri && activeSlot.col === ci);
                    const isHiddenFlight = cell && hiddenTileIds?.has(cell.id);
                    return (
                      <SlotCell key={`${ri}-${ci}`} row={ri} col={ci}>
                        {cell && !isDraggedAway && !isHiddenFlight && (
                          <DraggableTileCell
                            key={cell.id}
                            row={ri}
                            col={ci}
                            tile={cell}
                            indicator={indicator}
                            selected={selectedIds.has(cell.id) && !(indicator && isOkey(cell, indicator))}
                            onSelect={() => onTileTap(cell.id)}
                            meldGroup={meldGroupByTileId?.get(cell.id)}
                          />
                        )}
                      </SlotCell>
                    );
                  })}
                </div>
                {/* Rack shelf lip */}
                <div style={{
                  height: 3, borderRadius: 1,
                  background: 'linear-gradient(90deg, transparent 2%, rgba(196,154,108,0.5) 20%, rgba(196,154,108,0.7) 50%, rgba(196,154,108,0.5) 80%, transparent 98%)',
                  marginTop: 1,
                }} />
              </div>
            ))}
          </div>
        </div>

        <OwnDiscardDropZone
          indicator={indicator}
          lastTile={lastOwnDiscard ?? null}
          dropEnabled={dropToOwnPileEnabled}
        />
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeTile && (
          <TileComponent tile={activeTile} indicator={indicator} dragging size="md" disableSharedLayout />
        )}
      </DragOverlay>
    </DndContext>
  );
}
