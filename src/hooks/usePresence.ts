import { doc, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { db } from '../config/firebase';

export function usePresence(gameId: string | null, uid: string | null) {
  useEffect(() => {
    if (!gameId || !uid) return;

    const ref = doc(db, 'games', gameId);

    // Mark as connected
    updateDoc(ref, {
      [`players.${uid}.connected`]: true,
    }).catch(() => {});

    // Mark as disconnected when tab closes
    // Firestore doesn't support onDisconnect natively, so we use beforeunload
    const handleUnload = () => {
      // Use sendBeacon or navigator to fire a request on unload
      updateDoc(ref, {
        [`players.${uid}.connected`]: false,
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [gameId, uid]);
}
