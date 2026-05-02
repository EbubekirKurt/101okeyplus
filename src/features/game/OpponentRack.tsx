import React from 'react';

interface OpponentRackProps {
  tileCount: number;
  position: 'top' | 'left' | 'right';
}

const RACK_RAIL = 'linear-gradient(180deg, #c49a6c, #8b5e30)';

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

function HorizontalRack({ tileCount, size }: { tileCount: number; size: 'xs' | 'sm' }) {
  const count = Math.min(tileCount, 22);
  const half = Math.ceil(count / 2);
  const row1 = half;
  const row2 = count - half;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 6px 0' }}>
        <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          {[...Array(row1)].map((_, i) => <FaceDownMiniTile key={`t1-${i}`} size={size} />)}
        </div>
        {row2 > 0 && (
          <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            {[...Array(row2)].map((_, i) => <FaceDownMiniTile key={`t2-${i}`} size={size} />)}
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

// Dimensions of HorizontalRack with size="xs" for up to 22 tiles
// row1 = 11 tiles: 11*26 + 10*2 + 12(padding) = 318px wide
// height: 4 + 38 + 2 + 38 + 8 = 90px tall
const SIDE_RACK_W = 322;
const SIDE_RACK_H = 92;

export function OpponentRack({ tileCount, position }: OpponentRackProps) {
  if (position === 'top') return <HorizontalRack tileCount={tileCount} size="sm" />;

  // For side players: render the same HorizontalRack rotated 90°.
  // Outer container visual dimensions after rotation: H wide, W tall (dimensions swapped).
  const outerW = SIDE_RACK_H;  // 92px
  const outerH = SIDE_RACK_W;  // 322px

  // Place the WxH rack absolutely, centered in the HxW container, then rotate it.
  const innerLeft = (outerW - SIDE_RACK_W) / 2;  // (92 - 322) / 2 = -115
  const innerTop  = (outerH - SIDE_RACK_H) / 2;  // (322 - 92)  / 2 =  115

  return (
    <div style={{ width: outerW, height: outerH, position: 'relative', flexShrink: 0 }}>
      <div style={{
        position: 'absolute',
        left: innerLeft,
        top: innerTop,
        transformOrigin: `${SIDE_RACK_W / 2}px ${SIDE_RACK_H / 2}px`,
        transform: `rotate(${position === 'left' ? '-90deg' : '90deg'})`,
      }}>
        <HorizontalRack tileCount={tileCount} size="xs" />
      </div>
    </div>
  );
}
