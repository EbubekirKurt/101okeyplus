import { Meld } from './meld';
import { Player } from './player';
import { Tile, TileColor, TileNumber } from './tile';

export type GamePhase =
  | 'waiting'
  | 'dealing'
  | 'awaiting_draw'
  | 'awaiting_discard'
  | 'round_end'
  | 'game_over';

export interface IndicatorInfo {
  indicatorTile: Tile;
  okeyColor: TileColor;
  okeyNumber: TileNumber;
}

export interface GameState {
  id: string;
  roomId: string;
  roundNumber: number;
  phase: GamePhase;
  seed: number;
  turnOrder: string[];
  currentTurnUid: string;
  turnDeadline: number | null;
  indicator: IndicatorInfo | null;
  drawPileCount: number;
  drawPileEmpty: boolean;
  discardPiles: Record<string, Tile[]>;
  melds: Meld[];
  players: Record<string, Player>;
  lastMoveAt: number;
  version: number;
  winnerId: string | null;
  // işlek: uid of player who called işlek, tileId they flagged
  islek: { callerUid: string; tileId: string } | null;
  /** Soldan atılanı aldıktan sonra seri/çift açma zorunluluğu; iptal veya açılışla temizlenir. */
  mustOpenFromDiscard?: { pickerUid: string; fromUid: string; tileId: string } | null;
  /** Seri/grup açılış tabanı — toplam puan ≥ bu değer (ilk 101; biri P ile açınca sonraki min = P+1). */
  minOpenPoints?: number;
  /** Çift açma tabanı — geçerli çift sayısı ≥ bu (ilk 5; biri N çiftle açınca sonraki min = N+1). */
  minOpenPairCount?: number;
}

export type MoveType =
  | { type: 'draw_from_pile'; by: string; ts: number }
  | { type: 'draw_from_discard'; by: string; fromUid: string; tileId: string; ts: number }
  | { type: 'return_discard_draw_pile'; by: string; fromUid: string; returnedTileId: string; ts: number }
  | { type: 'discard'; by: string; tileId: string; penaltyForOkey?: boolean; ts: number }
  | { type: 'open_melds'; by: string; melds: Meld[]; ts: number }
  | { type: 'lay_melds'; by: string; melds: Meld[]; ts: number }
  | { type: 'open_five_pairs'; by: string; tiles: Tile[]; ts: number }
  | { type: 'extend_meld'; by: string; meldId: string; tileIds: string[]; ts: number }
  | { type: 'declare_finish'; by: string; melds: Meld[]; ts: number }
  | { type: 'call_islek'; by: string; tileId: string; ts: number };
