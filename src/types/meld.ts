import { Tile } from './tile';

export interface Meld {
  id: string;
  type: 'group' | 'run';
  tiles: Tile[];
  ownerId: string;
}
