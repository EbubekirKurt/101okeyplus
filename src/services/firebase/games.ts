import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot as onSnap,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { repairHandTileIds } from '../../lib/tiles/repairTileIds';
import { GameState, MoveType } from '../../types/game';
import { Tile } from '../../types/tile';

export async function createGame(game: GameState): Promise<void> {
  await setDoc(doc(db, 'games', game.id), game);
}

export async function updateGame(gameId: string, updates: Partial<GameState>): Promise<void> {
  await updateDoc(doc(db, 'games', gameId), updates as Record<string, unknown>);
}

export async function getGame(gameId: string): Promise<GameState | null> {
  const snap = await getDoc(doc(db, 'games', gameId));
  return snap.exists() ? (snap.data() as GameState) : null;
}

export function subscribeGame(gameId: string, callback: (game: GameState | null) => void) {
  return onSnapshot(doc(db, 'games', gameId), (snap) => {
    callback(snap.exists() ? (snap.data() as GameState) : null);
  });
}

export async function savePrivateHand(gameId: string, uid: string, tiles: Tile[]): Promise<void> {
  await setDoc(doc(db, 'games', gameId, 'hands', uid), { uid, tiles: repairHandTileIds(tiles) });
}

export async function getPrivateHand(gameId: string, uid: string): Promise<Tile[]> {
  const snap = await getDoc(doc(db, 'games', gameId, 'hands', uid));
  if (!snap.exists()) return [];
  return repairHandTileIds((snap.data() as { tiles: Tile[] }).tiles);
}

export function subscribeHand(gameId: string, uid: string, callback: (tiles: Tile[]) => void) {
  return onSnapshot(doc(db, 'games', gameId, 'hands', uid), (snap) => {
    callback(snap.exists() ? repairHandTileIds((snap.data() as { tiles: Tile[] }).tiles) : []);
  });
}

export async function appendMove(gameId: string, move: MoveType): Promise<void> {
  await addDoc(collection(db, 'games', gameId, 'moves'), move);
}

export function subscribeMoves(gameId: string, callback: (moves: MoveType[]) => void) {
  const q = query(collection(db, 'games', gameId, 'moves'), orderBy('ts', 'asc'), limit(50));
  return onSnap(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as MoveType));
  });
}
