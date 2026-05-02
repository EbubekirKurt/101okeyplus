export type RoomStatus = 'open' | 'in_game' | 'finished';

export interface Room {
  id: string;
  hostUid: string;
  status: RoomStatus;
  playerUids: string[];
  playerNames: Record<string, string>;
  maxPlayers: 2 | 3 | 4;
  createdAt: number;
  gameId: string | null;
}

export interface ChatMessage {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  ts: number;
}
