import { FakeJokerTile, NumberedTile, Tile, TileColor, TileNumber } from '../../types/tile';

const COLORS: TileColor[] = ['red', 'blue', 'black', 'yellow'];
const NUMBERS: TileNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export function createDeck(): Tile[] {
  const tiles: Tile[] = [];

  for (const color of COLORS) {
    for (const number of NUMBERS) {
      for (const copy of [0, 1] as const) {
        const tile: NumberedTile = {
          kind: 'numbered',
          id: `${color[0].toUpperCase()}-${number}-${copy}`,
          color,
          number,
          copy,
        };
        tiles.push(tile);
      }
    }
  }

  // 2 fake jokers
  for (const copy of [0, 1] as const) {
    const joker: FakeJokerTile = {
      kind: 'fake-joker',
      id: `FJ-${copy}`,
      copy,
    };
    tiles.push(joker);
  }

  return tiles; // 106 tiles total
}
