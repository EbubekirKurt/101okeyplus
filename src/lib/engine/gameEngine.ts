import { GameState, IndicatorInfo } from '../../types/game';
import { Meld } from '../../types/meld';
import { Player } from '../../types/player';
import { Tile } from '../../types/tile';
import { validateMeld, validateFivePairs, totalMeldPoints } from '../melds/validateMeld';
import { isOkey } from '../tiles/okey';
import { PENALTY } from '../scoring/scoreHand';
import { dealGame } from './deal';

export const MIN_OPEN_POINTS = 101;

export function createInitialGameState(
  gameId: string,
  roomId: string,
  playerUids: string[],
  playerNames: Record<string, string>,
  hostUid: string,
  seed: number,
): { gameState: GameState; hands: Record<string, Tile[]>; drawPile: Tile[] } {
  const { hands, drawPile, indicator } = dealGame(playerUids, seed);

  const players: Record<string, Player> = {};
  playerUids.forEach((uid, idx) => {
    players[uid] = {
      uid,
      displayName: playerNames[uid] || uid,
      seat: idx as 0 | 1 | 2 | 3,
      isHost: uid === hostUid,
      connected: true,
      totalScore: 0,
      roundScore: 0,
      eliminated: false,
      hasOpened: false,
      // Dealer (idx=0) gets 22, others get 21
      handCount: idx === 0 ? 22 : 21,
      isReady: false,
    };
  });

  const gameState: GameState = {
    id: gameId,
    roomId,
    roundNumber: 1,
    phase: 'awaiting_discard', // dealer has 22 tiles, must discard first
    seed,
    turnOrder: playerUids,
    currentTurnUid: playerUids[0],
    turnDeadline: Date.now() + 90000,
    indicator,
    drawPileCount: drawPile.length,
    drawPileEmpty: false,
    discardPiles: Object.fromEntries(playerUids.map(uid => [uid, []])),
    melds: [],
    islek: null,
    players,
    lastMoveAt: Date.now(),
    version: 0,
    winnerId: null,
  };

  return { gameState, hands, drawPile };
}

export function getNextPlayer(turnOrder: string[], currentUid: string, players: Record<string, Player>): string {
  const idx = turnOrder.indexOf(currentUid);
  let next = (idx + 1) % turnOrder.length;
  let guard = 0;
  while (players[turnOrder[next]]?.eliminated && guard++ < turnOrder.length) {
    next = (next + 1) % turnOrder.length;
  }
  return turnOrder[next];
}

// Validate a full opening attempt (regular melds + çift açma)
export function canOpenMelds(
  melds: Array<Omit<Meld, 'id' | 'ownerId'>>,
  indicator: IndicatorInfo,
  hand: Tile[],
): { valid: boolean; reason?: string } {
  const usedIds = new Set(melds.flatMap(m => m.tiles.map(t => t.id)));
  const handIds = new Set(hand.map(t => t.id));
  for (const id of usedIds) {
    if (!handIds.has(id)) return { valid: false, reason: 'Elde olmayan taş kullanıldı' };
  }

  for (const meld of melds) {
    if (!validateMeld(meld, indicator)) {
      return { valid: false, reason: 'Geçersiz seri veya grup var' };
    }
  }

  const points = totalMeldPoints(melds, indicator);
  if (points < MIN_OPEN_POINTS) {
    return { valid: false, reason: `En az ${MIN_OPEN_POINTS} puan gerekli (şu an: ${points})` };
  }

  return { valid: true };
}

// 5 çift açma validation
export function canOpenFivePairs(
  tiles: Tile[],
  indicator: IndicatorInfo,
  hand: Tile[],
): { valid: boolean; reason?: string } {
  const handIds = new Set(hand.map(t => t.id));
  for (const t of tiles) {
    if (!handIds.has(t.id)) return { valid: false, reason: 'Elde olmayan taş' };
  }
  if (!validateFivePairs(tiles, indicator)) {
    return { valid: false, reason: '5 farklı çift gerekli' };
  }
  return { valid: true };
}

// Check if a discarded tile is okey — triggers 101 penalty for the discarder
export function isThrewOkey(tileId: string, hand: Tile[], indicator: IndicatorInfo): boolean {
  const tile = hand.find(t => t.id === tileId);
  if (!tile) return false;
  return isOkey(tile, indicator);
}

// Calculate round-end penalties for players who didn't open
export function calculateRoundPenalties(
  hands: Record<string, Tile[]>,
  players: Record<string, Player>,
  indicator: IndicatorInfo,
  drawPileEmpty: boolean,
): Record<string, number> {
  const penalties: Record<string, number> = {};
  for (const [uid, player] of Object.entries(players)) {
    if (player.hasOpened) {
      penalties[uid] = 0;
    } else if (drawPileEmpty) {
      // Okey bitişi — draw pile tükendi, henüz açamamış
      penalties[uid] = PENALTY.OKEY_END;
    } else {
      // Normal bitiş, açamamış
      penalties[uid] = PENALTY.CANNOT_OPEN;
    }
  }
  return penalties;
}
