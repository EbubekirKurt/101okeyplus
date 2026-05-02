import { Tile } from '../../types/tile';

/**
 * Canonical id format (must match createDeck). Repairs Firestore drift where
 * `id` does not match `color`/`number`/`copy`, which would duplicate ids for
 * the two physical okey tiles and couple flip / drag behaviour.
 */
export function repairHandTileIds(tiles: Tile[]): Tile[] {
  return tiles.map((t) => {
    if (t.kind === 'fake-joker') {
      const id = `FJ-${t.copy}`;
      return t.id === id ? t : { ...t, id };
    }
    const id = `${t.color[0].toUpperCase()}-${t.number}-${t.copy}`;
    return t.id === id ? t : { ...t, id };
  });
}
