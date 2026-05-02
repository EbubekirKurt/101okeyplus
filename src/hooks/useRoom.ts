import { useEffect, useState } from 'react';
import { subscribeRoom } from '../services/firebase/rooms';
import { Room } from '../types/room';

export function useRoom(code: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeRoom(code, (r) => {
      setRoom(r);
      setLoading(false);
    });
    return unsub;
  }, [code]);

  return { room, loading };
}
