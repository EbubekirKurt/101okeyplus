import { useEffect, useState } from 'react';
import { subscribeGame, subscribeHand } from '../services/firebase/games';
import { GameState } from '../types/game';
import { Tile } from '../types/tile';

export function useGame(gameId: string | null) {
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeGame(gameId, (g) => {
      setGame(g);
      setLoading(false);
    });
    return unsub;
  }, [gameId]);

  return { game, loading };
}

export function useHand(gameId: string | null, uid: string | null) {
  const [hand, setHand] = useState<Tile[]>([]);

  useEffect(() => {
    if (!gameId || !uid) return;
    const unsub = subscribeHand(gameId, uid, setHand);
    return unsub;
  }, [gameId, uid]);

  return hand;
}
