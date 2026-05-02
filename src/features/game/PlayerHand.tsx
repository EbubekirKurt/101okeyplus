import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { IndicatorInfo } from '../../types/game';
import { Tile } from '../../types/tile';
import { TileComponent } from '../tile/Tile';

const MELD_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];

function SortableTile({ tile, indicator, selected, onSelect, meldGroup }: {
  tile: Tile;
  indicator: IndicatorInfo | null;
  selected: boolean;
  onSelect: () => void;
  meldGroup?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tile.id });
  const color = meldGroup !== undefined ? MELD_COLORS[meldGroup % MELD_COLORS.length] : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      className="relative"
      {...attributes} {...listeners}
    >
      <TileComponent tile={tile} indicator={indicator} selected={selected} onClick={onSelect} dragging={isDragging} size="md" />
      {/* Meld group indicator bar */}
      {color && (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-lg"
          style={{ height: 3, background: color, opacity: 0.85 }}
        />
      )}
    </div>
  );
}

interface PlayerHandProps {
  tiles: Tile[];
  indicator: IndicatorInfo | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onReorder: (tiles: Tile[]) => void;
  isMyTurn: boolean;
  meldGroupByTileId?: Map<string, number>;
}

export function PlayerHand({ tiles, indicator, selectedIds, onToggleSelect, onReorder, isMyTurn, meldGroupByTileId }: PlayerHandProps) {
  const [ordered, setOrdered] = useState<Tile[]>(tiles);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setOrdered(prev => {
      const prevIds = new Set(prev.map(t => t.id));
      const newIds = new Set(tiles.map(t => t.id));
      return [...prev.filter(t => newIds.has(t.id)), ...tiles.filter(t => !prevIds.has(t.id))];
    });
  }, [tiles]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart(e: DragStartEvent) { setActiveId(e.active.id as string); }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over || e.active.id === e.over.id) return;
    const oi = ordered.findIndex(t => t.id === e.active.id);
    const ni = ordered.findIndex(t => t.id === e.over!.id);
    const next = arrayMove(ordered, oi, ni);
    setOrdered(next);
    onReorder(next);
  }

  const activeTile = activeId ? ordered.find(t => t.id === activeId) : null;

  const mid = Math.ceil(ordered.length / 2);
  const row1 = ordered.slice(0, mid);
  const row2 = ordered.slice(mid);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <SortableContext items={ordered.map(t => t.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-col gap-1.5 items-center">
          {/* Row 1 */}
          <div className="flex gap-1 items-end justify-center flex-wrap">
            <AnimatePresence>
              {row1.map(tile => (
                <motion.div key={tile.id} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                  <SortableTile
                    tile={tile}
                    indicator={indicator}
                    selected={selectedIds.has(tile.id)}
                    onSelect={() => onToggleSelect(tile.id)}
                    meldGroup={meldGroupByTileId?.get(tile.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {/* Row 2 */}
          {row2.length > 0 && (
            <div className="flex gap-1 items-end justify-center flex-wrap">
              <AnimatePresence>
                {row2.map(tile => (
                  <motion.div key={tile.id} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.05 }}>
                    <SortableTile
                      tile={tile}
                      indicator={indicator}
                      selected={selectedIds.has(tile.id)}
                      onSelect={() => onToggleSelect(tile.id)}
                      meldGroup={meldGroupByTileId?.get(tile.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeTile && <TileComponent tile={activeTile} indicator={indicator} dragging size="md" />}
      </DragOverlay>
    </DndContext>
  );
}
