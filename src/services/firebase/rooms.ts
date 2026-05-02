import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Room } from '../../types/room';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createRoom(hostUid: string, hostName: string, maxPlayers: 2 | 3 | 4 = 4): Promise<Room> {
  const id = generateRoomCode();
  const room: Room = {
    id,
    hostUid,
    status: 'open',
    playerUids: [hostUid],
    playerNames: { [hostUid]: hostName },
    maxPlayers,
    createdAt: Date.now(),
    gameId: null,
  };
  await setDoc(doc(db, 'rooms', id), room);
  return room;
}

export async function joinRoom(code: string, uid: string, displayName: string): Promise<Room> {
  const ref = doc(db, 'rooms', code.toUpperCase());
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error('Oda bulunamadı');

  const room = snap.data() as Room;
  if (room.status !== 'open') throw new Error('Oyun zaten başladı');
  if (room.playerUids.length >= room.maxPlayers) throw new Error('Oda dolu');
  if (room.playerUids.includes(uid)) return room;

  await updateDoc(ref, {
    playerUids: arrayUnion(uid),
    [`playerNames.${uid}`]: displayName,
  });

  return { ...room, playerUids: [...room.playerUids, uid] };
}

export async function leaveRoom(code: string, uid: string): Promise<void> {
  const ref = doc(db, 'rooms', code);
  await updateDoc(ref, {
    playerUids: arrayRemove(uid),
  });
}

export async function setPlayerReady(code: string, uid: string, ready: boolean): Promise<void> {
  await updateDoc(doc(db, 'rooms', code), {
    [`readyStates.${uid}`]: ready,
  });
}

export function subscribeRoom(code: string, callback: (room: Room | null) => void) {
  return onSnapshot(doc(db, 'rooms', code), (snap) => {
    callback(snap.exists() ? (snap.data() as Room) : null);
  });
}

export async function startGame(code: string, gameId: string): Promise<void> {
  await updateDoc(doc(db, 'rooms', code), {
    status: 'in_game',
    gameId,
  });
}
