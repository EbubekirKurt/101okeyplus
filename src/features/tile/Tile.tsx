import { motion } from 'framer-motion';
import React from 'react';
import { IndicatorInfo } from '../../types/game';
import { Tile as TileType } from '../../types/tile';
import { isOkey } from '../../lib/tiles/okey';

interface TileProps {
  tile: TileType;
  indicator?: IndicatorInfo | null;
  selected?: boolean;
  onClick?: () => void;
  dragging?: boolean;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  layoutId?: string;
}

const COLOR_HEX = {
  red: '#dc2626',
  blue: '#2563eb',
  black: '#1a1a1a',
  yellow: '#ca8a04',
};

const SIZE = {
  xs: { w: 28, h: 40, num: 13, star: 9 },
  sm: { w: 36, h: 52, num: 17, star: 11 },
  md: { w: 44, h: 62, num: 22, star: 13 },
  lg: { w: 54, h: 76, num: 28, star: 15 },
};

export function TileComponent({
  tile, indicator, selected, onClick, dragging, faceDown, size = 'md', className = '', layoutId,
}: TileProps) {
  const sz = SIZE[size];
  const isWild = tile.kind === 'fake-joker' || (indicator ? isOkey(tile, indicator) : false);

  if (faceDown) {
    return (
      <div
        style={{ width: sz.w, height: sz.h }}
        className={`rounded-lg flex-shrink-0 ${className}`}
        onClick={onClick}
      >
        <div
          className="w-full h-full rounded-lg"
          style={{
            background: 'linear-gradient(145deg, #7c5c3a 0%, #4a3520 50%, #3a2818 100%)',
            border: '1.5px solid #5a4030',
            boxShadow: '0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        />
      </div>
    );
  }

  const color = tile.kind === 'numbered' ? COLOR_HEX[tile.color] : '#7c3aed';
  const number = tile.kind === 'numbered' ? tile.number : '★';

  return (
    <motion.div
      layoutId={layoutId ?? tile.id}
      onClick={onClick}
      whileHover={!dragging ? { y: -5, scale: 1.07 } : {}}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 600, damping: 28 }}
      style={{ width: sz.w, height: sz.h }}
      className={`relative rounded-lg flex-shrink-0 cursor-pointer select-none ${className}`}
    >
      {/* Tile body */}
      <div
        className="w-full h-full rounded-lg flex flex-col items-center justify-center relative overflow-hidden"
        style={{
          background: selected
            ? 'linear-gradient(160deg, #fffbea 0%, #fef3c7 100%)'
            : 'linear-gradient(160deg, #fefce8 0%, #fef9e7 40%, #faefc8 100%)',
          border: selected
            ? `2px solid ${color}`
            : isWild
              ? '2px solid #a855f7'
              : '1.5px solid #d4bc70',
          boxShadow: selected
            ? `0 0 0 2px ${color}40, 0 6px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.9)`
            : dragging
              ? '0 12px 32px rgba(0,0,0,0.5)'
              : '0 3px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.85)',
          transform: selected ? 'translateY(-8px)' : undefined,
        }}
      >
        {/* Subtle texture lines */}
        <div className="absolute inset-0 rounded-lg opacity-10"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 4px)' }} />

        {/* Number */}
        <span
          className="font-black leading-none relative z-10"
          style={{ fontSize: sz.num, color, textShadow: `0 1px 2px rgba(0,0,0,0.15)` }}
        >
          {tile.kind === 'fake-joker' ? '☆' : tile.number}
        </span>

        {/* Star indicator */}
        <span
          className="leading-none relative z-10 mt-0.5"
          style={{ fontSize: sz.star, color: isWild ? '#a855f7' : color, opacity: 0.85 }}
        >
          ★
        </span>

        {/* Okey crown indicator */}
        {isWild && tile.kind !== 'fake-joker' && (
          <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-purple-500 flex items-center justify-center">
            <span className="text-white" style={{ fontSize: 7 }}>O</span>
          </div>
        )}
        {tile.kind === 'fake-joker' && (
          <div className="absolute inset-0 rounded-lg border-2 border-purple-400/60" />
        )}
      </div>
    </motion.div>
  );
}
