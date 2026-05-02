import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { IndicatorInfo } from '../../types/game';
import { Meld } from '../../types/meld';
import { TileComponent } from '../tile/Tile';

interface MeldCardProps {
  meld: Meld;
  indicator: IndicatorInfo | null;
  canExtend?: boolean;
  onExtend?: (meldId: string) => void;
}

function MeldCard({ meld, indicator, canExtend, onExtend }: MeldCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `meld-${meld.id}`,
    data: { type: 'meld', meldId: meld.id },
  });

  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      ref={setNodeRef}
      className={`
        flex items-center gap-0.5 p-2 rounded-lg border-2 transition-colors cursor-pointer
        ${isOver ? 'border-amber-400 bg-amber-900/30' : 'border-amber-800/40 bg-black/20'}
        ${canExtend ? 'hover:border-amber-500 hover:bg-amber-900/20' : ''}
      `}
      onClick={() => canExtend && onExtend?.(meld.id)}
    >
      {meld.tiles.map((tile) => (
        <TileComponent key={tile.id} tile={tile} indicator={indicator} size="sm" />
      ))}
      <div className={`ml-1 text-xs font-medium px-1.5 py-0.5 rounded ${
        meld.type === 'group'
          ? 'bg-blue-800/60 text-blue-200'
          : 'bg-green-800/60 text-green-200'
      }`}>
        {meld.type === 'group' ? 'G' : 'S'}
      </div>
    </motion.div>
  );
}

interface MeldAreaProps {
  melds: Meld[];
  indicator: IndicatorInfo | null;
  myUid: string;
  canExtend?: boolean;
  onExtendMeld?: (meldId: string) => void;
}

export function MeldArea({ melds, indicator, myUid, canExtend, onExtendMeld }: MeldAreaProps) {
  const myMelds = melds.filter((m) => m.ownerId === myUid);
  const otherMelds = melds.filter((m) => m.ownerId !== myUid);

  return (
    <div className="space-y-2">
      {otherMelds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {otherMelds.map((meld) => (
              <MeldCard key={meld.id} meld={meld} indicator={indicator} />
            ))}
          </AnimatePresence>
        </div>
      )}
      {myMelds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {myMelds.map((meld) => (
              <MeldCard
                key={meld.id}
                meld={meld}
                indicator={indicator}
                canExtend={canExtend}
                onExtend={onExtendMeld}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
