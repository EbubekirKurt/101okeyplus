import { GameState, IndicatorInfo } from '../../types/game';
import { Meld } from '../../types/meld';
import { Player } from '../../types/player';
import { Tile } from '../../types/tile';
import { validateMeld, validateNPairs, totalMeldPoints } from '../melds/validateMeld';
import { isOkey } from '../tiles/okey';
import { PENALTY } from '../scoring/scoreHand';
import { dealGame } from './deal';

export const MIN_OPEN_POINTS = 101;
export const MIN_OPEN_PAIR_COUNT = 5;

/**
 * Eski istemciler bazen açılıştan sonra `minOpenPoints = 2 * açılanPuan` yazıyordu;
 * olması gereken her zaman `açılanPuan + 1`. Tipik çiftlenmiş aralığı tekilleştirir.
 */
function normalizeLegacyDoubledMinOpenPoints(stored: number): number {
  if (stored < 200 || stored > 300 || stored % 2 !== 0) return stored;
  const impliedPrevOpenTotal = stored / 2;
  if (impliedPrevOpenTotal < MIN_OPEN_POINTS || impliedPrevOpenTotal > 160) return stored;
  return impliedPrevOpenTotal + 1;
}

export function effectiveMinOpenPoints(game: { minOpenPoints?: number } | null | undefined): number {
  const raw = game?.minOpenPoints ?? MIN_OPEN_POINTS;
  return normalizeLegacyDoubledMinOpenPoints(raw);
}

export function effectiveMinOpenPairCount(game: { minOpenPairCount?: number } | null | undefined): number {
  return game?.minOpenPairCount ?? MIN_OPEN_PAIR_COUNT;
}

/** Biri toplam P puanlık per açtıysa sonraki seri/grup açılışı için min = P+1. */
export function nextMinOpenPointsAfterMeldOpen(openedTotalPoints: number): number {
  return openedTotalPoints + 1;
}

/** Biri N çiftle açtıysa sonraki çift açılışı için min = N+1. */
export function nextMinOpenPairCountAfterPairOpen(openedPairCount: number): number {
  return openedPairCount + 1;
}

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
    mustOpenFromDiscard: null,
    minOpenPoints: MIN_OPEN_POINTS,
    minOpenPairCount: MIN_OPEN_PAIR_COUNT,
    players,
    lastMoveAt: Date.now(),
    version: 0,
    winnerId: null,
  };

  return { gameState, hands, drawPile };
}

/** Masa düzeninde (alt = ben) sol taraftaki rakibin uid'i — turnOrder içindeki sıraya göre. */
export function getLeftOpponentUid(turnOrder: string[], myUid: string): string | undefined {
  const others = turnOrder.filter(u => u !== myUid);
  return others[1];
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

// Validate a full opening attempt (geçerli perler; toplam puan ≥ eşik)
export function canOpenMelds(
  melds: Array<Omit<Meld, 'id' | 'ownerId'>>,
  indicator: IndicatorInfo,
  hand: Tile[],
  minPoints?: number,
): { valid: boolean; reason?: string } {
  const allIds = melds.flatMap(m => m.tiles.map(t => t.id));
  const usedIds = new Set(allIds);
  if (allIds.length !== usedIds.size) {
    return { valid: false, reason: 'Aynı taş birden fazla perde kullanılamaz' };
  }
  const handIds = new Set(hand.map(t => t.id));
  for (const id of usedIds) {
    if (!handIds.has(id)) return { valid: false, reason: 'Elde olmayan taş kullanıldı' };
  }

  for (const meld of melds) {
    if (!validateMeld(meld, indicator)) {
      return { valid: false, reason: 'Geçersiz seri veya grup var' };
    }
  }

  const minPts = minPoints ?? MIN_OPEN_POINTS;
  const points = totalMeldPoints(melds, indicator);
  if (points < minPts) {
    return { valid: false, reason: `En az ${minPts} puan gerekli (şu an: ${points})` };
  }

  return { valid: true };
}

/** N çift açma (masadaki minOpenPairCount = N). */
export function canOpenFivePairs(
  tiles: Tile[],
  indicator: IndicatorInfo,
  hand: Tile[],
  minPairCount: number = MIN_OPEN_PAIR_COUNT,
): { valid: boolean; reason?: string } {
  const need = minPairCount * 2;
  const handIds = new Set(hand.map(t => t.id));
  for (const t of tiles) {
    if (!handIds.has(t.id)) return { valid: false, reason: 'Elde olmayan taş' };
  }
  if (tiles.length !== need) {
    return { valid: false, reason: `${minPairCount} çift için tam ${need} taş seçmelisin` };
  }
  if (!validateNPairs(tiles, indicator, minPairCount)) {
    return {
      valid: false,
      reason: `${need} taştan ${minPairCount} geçerli çift (aynı renk ve sayı; okey joker sayılır) oluşturulmalı`,
    };
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
