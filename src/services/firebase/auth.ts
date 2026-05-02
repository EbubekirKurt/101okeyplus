import { signInAnonymously, onAuthStateChanged, User, updateProfile, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../config/firebase';

const LS_NAME_KEY = 'okey101_name';
const LS_UID_KEY = 'okey101_uid';

export function getSavedName(): string | null {
  return localStorage.getItem(LS_NAME_KEY);
}

export function getSavedUid(): string | null {
  return localStorage.getItem(LS_UID_KEY);
}

export function saveName(name: string) {
  localStorage.setItem(LS_NAME_KEY, name);
}

export async function signInAnon(): Promise<User> {
  const result = await signInAnonymously(auth);
  localStorage.setItem(LS_UID_KEY, result.user.uid);
  return result.user;
}

export async function registerUser(name: string): Promise<User> {
  const result = await signInAnonymously(auth);
  await updateProfile(result.user, { displayName: name });
  saveName(name);
  localStorage.setItem(LS_UID_KEY, result.user.uid);
  return result.user;
}

export async function setDisplayName(name: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Not authenticated');
  await updateProfile(auth.currentUser, { displayName: name });
  saveName(name);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function currentUser(): User | null {
  return auth.currentUser;
}
