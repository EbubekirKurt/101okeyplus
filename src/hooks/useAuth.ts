import { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { getSavedName, onAuthChange, registerUser, setDisplayName, signInAnon } from '../services/firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      if (u) {
        // Restore saved name if Firebase lost it (e.g. new session)
        const savedName = getSavedName();
        if (savedName && !u.displayName) {
          await setDisplayName(savedName).catch(() => {});
        }
      }
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, loading };
}
