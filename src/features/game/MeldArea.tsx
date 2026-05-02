import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useMemo } from 'react';
import { IndicatorInfo } from '../../types/game';
import { Meld } from '../../types/meld';
import { Player } from '../../types/player';
import { TileComponent } from '../tile/Tile';

/** Bir sütunda en fazla kaç per — 5. per bir sonraki sütunda başlar */
const MELDS_PER_COLUMN = 4;

interface MeldCardProps {
  meld: Meld;
  indicator: IndicatorInfo | null;
  ownerTooltip: string;
  canExtend?: boolean;
  onExtend?: (meldId: string) => void;
}

function MeldCard({ meld, indicator, ownerTooltip, canExtend, onExtend }: MeldCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `meld-${meld.id}`,
    data: { type: 'meld', meldId: meld.id },
  });

  return (
    <motion.div
      layout={false}
      initial={{ scale: 0.96, opacity: 1 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0.6 }}
      ref={setNodeRef}
      title={ownerTooltip}
      className={`
        flex items-center gap-px p-1 rounded-md border transition-colors cursor-pointer flex-shrink-0
        ${isOver ? 'border-amber-400 bg-amber-900/30' : 'border-amber-800/40 bg-black/20'}
        ${canExtend ? 'hover:border-amber-500 hover:bg-amber-900/20' : ''}
      `}
      onClick={() => canExtend && onExtend?.(meld.id)}
    >
      {meld.tiles.map((tile) => (
        <TileComponent key={tile.id} tile={tile} indicator={indicator} size="sm" />
      ))}
      <div className={`ml-px text-[10px] font-bold px-1 py-px rounded ${
        meld.type === 'group'
          ? 'bg-blue-800/60 text-blue-200'
          : 'bg-green-800/60 text-green-200'
      }`}>
        {meld.type === 'group' ? 'G' : 'S'}
      </div>
    </motion.div>
  );
}

/** Açılış / bitiş sırası */
function meldSortKey(meld: Meld): [number, number] {
  const open = meld.id.match(/-open-(\d+)-(\d+)$/);
  if (open) return [parseInt(open[1], 10), parseInt(open[2], 10)];
  const fin = meld.id.match(/-fin-(\d+)$/);
  if (fin) return [parseInt(fin[1], 10), 0];
  return [Number.MAX_SAFE_INTEGER - 1, 0];
}

interface MeldAreaProps {
  melds: Meld[];
  indicator: IndicatorInfo | null;
  myUid: string;
  players?: Record<string, Player>;
  canExtend?: boolean;
  onExtendMeld?: (meldId: string) => void;
}

export function MeldArea({ melds, indicator, myUid, players, canExtend, onExtendMeld }: MeldAreaProps) {
  function ownerLabel(ownerId: string): string {
    const name = players?.[ownerId]?.displayName;
    return name ?? ownerId.slice(0, 8);
  }
  const sortedMelds = useMemo(() => {
    return [...melds].sort((a, b) => {
      const ka = meldSortKey(a);
      const kb = meldSortKey(b);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      return ka[1] - kb[1];
    });
  }, [melds]);

  const meldColumns = useMemo(() => {
    const cols: Meld[][] = [];
    for (let i = 0; i < sortedMelds.length; i += MELDS_PER_COLUMN) {
      cols.push(sortedMelds.slice(i, i + MELDS_PER_COLUMN));
    }
    return cols;
  }, [sortedMelds]);

  return (
    <div className="flex flex-row flex-wrap gap-x-4 gap-y-2 items-start justify-start content-start w-full">
      {meldColumns.map((chunk, colIdx) => (
        <div
          key={colIdx}
          className="flex flex-col gap-1 items-start justify-start min-h-0 shrink-0"
        >
          <AnimatePresence>
            {chunk.map((meld) => (
              <MeldCard
                key={meld.id}
                meld={meld}
                indicator={indicator}
                ownerTooltip={
                  meld.ownerId === myUid
                    ? `Açan: ${ownerLabel(meld.ownerId)} (sen)`
                    : `Açan: ${ownerLabel(meld.ownerId)}`
                }
                canExtend={Boolean(canExtend && meld.ownerId === myUid)}
                onExtend={onExtendMeld}
              />
            ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
