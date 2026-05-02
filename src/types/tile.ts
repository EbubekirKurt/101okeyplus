export type TileColor = 'red' | 'blue' | 'black' | 'yellow';
export type TileNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface NumberedTile {
  kind: 'numbered';
  id: string;
  color: TileColor;
  number: TileNumber;
  copy: 0 | 1;
}

export interface FakeJokerTile {
  kind: 'fake-joker';
  id: string;
  copy: 0 | 1;
}

export type Tile = NumberedTile | FakeJokerTile;
