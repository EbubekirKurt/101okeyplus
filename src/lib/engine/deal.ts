import { IndicatorInfo } from '../../types/game';
import { Tile } from '../../types/tile';
import { shuffleWithSeed } from '../rng/seeded';
import { createDeck } from '../tiles/createDeck';
import { computeOkey } from '../tiles/okey';

export interface DealResult {
  hands: Record<string, Tile[]>;
  drawPile: Tile[];
  indicator: IndicatorInfo;
}

export function dealGame(playerUids: string[], seed: number): DealResult {
  const deck = shuffleWithSeed(createDeck(), seed);

  // Last tile is the indicator (gösterge) - left face-up
  const indicatorTile = deck[deck.length - 1];
  const remainingDeck = deck.slice(0, deck.length - 1);
  const indicator = computeOkey(indicatorTile);

  const hands: Record<string, Tile[]> = {};

  // Dealer (index 0) gets 22, others get 21
  let idx = 0;
  for (let i = 0; i < playerUids.length; i++) {
    const count = i === 0 ? 22 : 21;
    hands[playerUids[i]] = remainingDeck.slice(idx, idx + count);
    idx += count;
  }

  const drawPile = remainingDeck.slice(idx);

  return { hands, drawPile, indicator };
}
