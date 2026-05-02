import { motion } from 'framer-motion';
import React from 'react';
import { IndicatorInfo } from '../../types/game';
import { Tile as TileType } from '../../types/tile';
import { isOkey } from '../../lib/tiles/okey';
import { useUIStore } from '../../state/store';

function isRealOkeyNumbered(tile: TileType, indicator: IndicatorInfo): boolean {
  return tile.kind === 'numbered'
    && tile.color === indicator.okeyColor
    && tile.number === indicator.okeyNumber;
}

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
  /** When true, disables Framer layoutId/layout crossfade (avoids wrong tile morphing on the rack). */
  disableSharedLayout?: boolean;
  /** Rack: skip hover/tap springs so timer/re-renders do not fight the pointer and jitter tiles. */
  suppressMicroMotion?: boolean;
}

const COLOR_HEX = {
  red: '#dc2626',
  blue: '#2563eb',
  black: '#1a1a1a',
  yellow: '#ca8a04',
};

const SIZE = {
  xs: { w: 32, h: 46, num: 15, star: 10 },
  sm: { w: 42, h: 60, num: 20, star: 13 },
  md: { w: 52, h: 74, num: 26, star: 15 },
  lg: { w: 62, h: 90, num: 31, star: 18 },
};

export function TileComponent({
  tile, indicator, selected, onClick, dragging, faceDown, size = 'md', className = '', layoutId,
  disableSharedLayout, suppressMicroMotion,
}: TileProps) {
  const sz = SIZE[size];
  const isWild = Boolean(indicator && isOkey(tile, indicator));
  const okeyFaceHidden = useUIStore(s => s.okeyFaceHiddenIds.has(tile.id));
  const toggleOkeyFaceHidden = useUIStore(s => s.toggleOkeyFaceHidden);
  const isNumberedOkey = indicator ? isRealOkeyNumbered(tile, indicator) : false;
  const showBlankOkeyFace = isNumberedOkey && okeyFaceHidden;

  function handleClick() {
    if (isNumberedOkey) {
      toggleOkeyFaceHidden(tile.id);
      return;
    }
    onClick?.();
  }

  if (faceDown) {
    return (
      <div
        style={{ width: sz.w, height: sz.h }}
        className={`rounded-lg flex-shrink-0 ${className}`}
        onClick={handleClick}
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

  const motionLayoutProps = disableSharedLayout
    ? { layout: false as const }
    : { layoutId: layoutId ?? tile.id };

  if (showBlankOkeyFace) {
    return (
      <motion.div
        {...motionLayoutProps}
        onClick={handleClick}
        whileHover={suppressMicroMotion || dragging ? {} : { y: -5, scale: 1.07 }}
        whileTap={suppressMicroMotion ? {} : { scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 600, damping: 28 }}
        style={{ width: sz.w, height: sz.h }}
        className={`relative rounded-lg flex-shrink-0 cursor-pointer select-none ${className}`}
      >
        <div
          className="w-full h-full rounded-lg relative overflow-hidden"
          style={{
            background: '#ffffff',
            border: selected ? `2px solid ${color}` : '1.5px solid #e5e5e5',
            boxShadow: selected
              ? `0 0 0 2px ${color}40, 0 6px 16px rgba(0,0,0,0.2)`
              : dragging
                ? '0 12px 32px rgba(0,0,0,0.35)'
                : '0 3px 8px rgba(0,0,0,0.15)',
            transform: selected ? 'translateY(-8px)' : undefined,
          }}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      {...motionLayoutProps}
      onClick={handleClick}
      whileHover={suppressMicroMotion || dragging ? {} : { y: -5, scale: 1.07 }}
      whileTap={suppressMicroMotion ? {} : { scale: 0.94 }}
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
