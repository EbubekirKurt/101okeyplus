import React from 'react';

interface OpponentRackProps {
  tileCount: number;
  position: 'top' | 'left' | 'right';
}

const RACK_RAIL = 'linear-gradient(180deg, #c49a6c, #8b5e30)';
const RACK_SHELF = 'linear-gradient(90deg, #5d3a18 0%, #8b5e30 35%, #b07840 70%, #8b5e30 100%)';

function FaceDownMiniTile({ size }: { size: 'xs' | 'sm' }) {
  const w = size === 'xs' ? 26 : 34;
  const h = size === 'xs' ? 38 : 48;
  return (
    <div
      style={{
        width: w, height: h, borderRadius: 3, flexShrink: 0,
        background: 'linear-gradient(145deg, #7c5c3a 0%, #4a3520 50%, #3a2818 100%)',
        border: '1px solid #5a4030',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    />
  );
}

/** Kapalı taş — yan perspektif: iki sütun, yükseklik taş sayısına göre sıkışır */
function FaceDownSideStackTile({ w, h }: { w: number; h: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 2,
        flexShrink: 0,
        background: 'linear-gradient(160deg, #8a6e4a 0%, #5c4228 45%, #3d2a18 100%)',
        border: '1px solid #4a3520',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 2px rgba(0,0,0,0.45)',
      }}
    />
  );
}

function TopRack({ tileCount }: { tileCount: number }) {
  const count = Math.min(tileCount, 22);
  const half = Math.ceil(count / 2);
  const row1 = half;
  const row2 = count - half;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        padding: '4px 6px 0',
      }}>
        <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          {[...Array(row1)].map((_, i) => <FaceDownMiniTile key={`t1-${i}`} size="sm" />)}
        </div>
        {row2 > 0 && (
          <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            {[...Array(row2)].map((_, i) => <FaceDownMiniTile key={`t2-${i}`} size="sm" />)}
          </div>
        )}
      </div>
      <div style={{
        width: '100%', height: 8, borderRadius: '0 0 4px 4px',
        background: RACK_RAIL,
        boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
      }} />
    </div>
  );
}

const SIDE_RACK_MAX_H = 132;
const SIDE_GAP = 2;

function SideRack({ tileCount, side }: { tileCount: number; side: 'left' | 'right' }) {
  const count = Math.min(Math.max(tileCount, 0), 22);
  const half = Math.ceil(count / 2);
  const col1 = half;
  const col2 = count - half;
  const maxCol = Math.max(col1, col2, 1);
  const tileH = Math.min(24, Math.max(10, Math.floor((SIDE_RACK_MAX_H - 16 - (maxCol - 1) * SIDE_GAP) / maxCol)));
  const tileW = Math.max(14, Math.round(tileH * 0.72));

  const col = (n: number, key: string) => (
    <div
      key={key}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SIDE_GAP,
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
    >
      {[...Array(n)].map((_, i) => (
        <FaceDownSideStackTile key={`${key}-${i}`} w={tileW} h={tileH} />
      ))}
    </div>
  );

  const tilesBlock = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 5,
        alignItems: 'flex-end',
        padding: '6px 5px 5px',
        minHeight: SIDE_RACK_MAX_H - 10,
      }}
    >
      {col(col1, 'c1')}
      {col2 > 0 ? col(col2, 'c2') : <div style={{ width: tileW }} />}
    </div>
  );

  const shelf = (
    <div
      style={{
        height: 8,
        marginTop: -1,
        borderRadius: side === 'left' ? '0 0 0 6px' : '0 0 6px 0',
        background: RACK_SHELF,
        boxShadow: '0 2px 5px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)',
      }}
    />
  );

  const rail = (
    <div
      style={{
        width: 11,
        alignSelf: 'stretch',
        minHeight: SIDE_RACK_MAX_H,
        borderRadius: side === 'left' ? '6px 0 0 6px' : '0 6px 6px 0',
        background: RACK_RAIL,
        boxShadow: side === 'left'
          ? '-3px 0 6px rgba(0,0,0,0.35), inset -2px 0 4px rgba(0,0,0,0.25)'
          : '3px 0 6px rgba(0,0,0,0.35), inset 2px 0 4px rgba(0,0,0,0.25)',
      }}
    />
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: side === 'left' ? 'row' : 'row-reverse',
        alignItems: 'stretch',
        maxWidth: '100%',
      }}
    >
      {rail}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        {tilesBlock}
        {shelf}
      </div>
    </div>
  );
}

export function OpponentRack({ tileCount, position }: OpponentRackProps) {
  if (position === 'top') return <TopRack tileCount={tileCount} />;
  return <SideRack tileCount={tileCount} side={position} />;
}
