export interface Player {
  uid: string;
  displayName: string;
  seat: 0 | 1 | 2 | 3;
  isHost: boolean;
  connected: boolean;
  totalScore: number;
  roundScore: number;
  eliminated: boolean;
  hasOpened: boolean;
  handCount: number;
  isReady: boolean;
}
