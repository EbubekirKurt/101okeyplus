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

  // Gösterge fake joker olamaz — fake joker'i destedeki önceki taşla değiştir
  let indicatorIdx = deck.length - 1;
  while (indicatorIdx > 0 && deck[indicatorIdx].kind === 'fake-joker') {
    const swap = deck[indicatorIdx];
    deck[indicatorIdx] = deck[indicatorIdx - 1];
    deck[indicatorIdx - 1] = swap;
    indicatorIdx--;
  }

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

/** Next card that will be taken from the bank (same order as `drawPile[0]` first). */
export function peekNextDrawFromPile(game: { seed: number; turnOrder: string[]; drawPileCount: number }): Tile | null {
  const { drawPile } = dealGame(game.turnOrder, game.seed);
  const n = game.drawPileCount;
  if (n <= 0 || n > drawPile.length) return null;
  const i = drawPile.length - n;
  return drawPile[i] ?? null;
}
