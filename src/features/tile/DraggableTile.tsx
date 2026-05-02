import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';
import { IndicatorInfo } from '../../types/game';
import { Tile } from '../../types/tile';
import { TileComponent } from './Tile';

interface DraggableTileProps {
  tile: Tile;
  indicator?: IndicatorInfo | null;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function DraggableTile({ tile, indicator, selected, onSelect, disabled, size }: DraggableTileProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tile.id,
    disabled,
    data: { tile },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TileComponent
        tile={tile}
        indicator={indicator}
        selected={selected}
        onClick={onSelect}
        dragging={isDragging}
        size={size}
      />
    </div>
  );
}
