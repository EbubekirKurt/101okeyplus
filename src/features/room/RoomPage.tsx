import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { createInitialGameState } from '../../lib/engine/gameEngine';
import { createGame, savePrivateHand } from '../../services/firebase/games';
import { startGame, leaveRoom } from '../../services/firebase/rooms';
import { useAuth } from '../../hooks/useAuth';
import { useRoom } from '../../hooks/useRoom';

export function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { room, loading } = useRoom(code || null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (room?.status === 'in_game' && room.gameId) {
      navigate(`/game/${room.gameId}`);
    }
  }, [room?.status, room?.gameId]);

  function copyCode() {
    navigator.clipboard.writeText(code || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleStartGame() {
    if (!room || !user || !code) return;
    if (room.playerUids.length < 2) { toast.error('En az 2 oyuncu gerekli'); return; }
    setStarting(true);
    try {
      const gameId = `${code}-${Date.now()}`;
      const seed = Math.floor(Math.random() * 2 ** 32);
      const { gameState, hands } = createInitialGameState(
        gameId, code, room.playerUids, room.playerNames || {}, room.hostUid, seed
      );
      await createGame(gameState);
      for (const [uid, tiles] of Object.entries(hands)) {
        await savePrivateHand(gameId, uid, tiles);
      }
      await startGame(code, gameId);
    } catch (e: any) {
      toast.error(e.message || 'Oyun başlatılamadı');
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-felt">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-felt gap-4">
        <p className="text-red-400 text-xl">Oda bulunamadı</p>
        <button onClick={() => navigate('/')} className="btn-secondary px-6 py-3">← Ana Sayfa</button>
      </div>
    );
  }

  const isHost = user?.uid === room.hostUid;
  const canStart = isHost && room.playerUids.length >= 2;
  const emptySlots = room.maxPlayers - room.playerUids.length;

  return (
    <div className="min-h-screen flex items-center justify-center bg-felt px-4 py-8">
      <div className="w-full max-w-md space-y-4">

        {/* Header */}
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-2">
          <h1 className="text-3xl font-black text-amber-400">🎴 Oyun Odası</h1>
        </motion.div>

        {/* Room code card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card text-center">
          <p className="text-emerald-400 text-sm font-medium mb-3">Oda Kodu — Arkadaşına gönder</p>
          <button
            onClick={copyCode}
            className="group inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-black/30 border-2 border-amber-600/40 hover:border-amber-500 transition-all"
          >
            <span className="text-4xl font-black font-mono tracking-[0.3em] text-amber-300">{code}</span>
            <span className="text-amber-600 group-hover:text-amber-400 text-xl transition-colors">
              {copied ? '✓' : '⧉'}
            </span>
          </button>
          <AnimatePresence>
            {copied && (
              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-green-400 text-sm mt-2">Kopyalandı!</motion.p>
            )}
          </AnimatePresence>
          <p className="text-emerald-700 text-xs mt-3">{room.playerUids.length} / {room.maxPlayers} oyuncu</p>
        </motion.div>

        {/* Players */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
          <h2 className="text-emerald-400 font-semibold text-sm mb-4 uppercase tracking-wider">Oyuncular</h2>
          <div className="space-y-2">
            <AnimatePresence>
              {room.playerUids.map((uid, i) => {
                const playerName = (room.playerNames || {})[uid] || uid.slice(0, 8);
                const isMe = uid === user?.uid;
                const isRoomHost = uid === room.hostUid;
                return (
                  <motion.div
                    key={uid}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-3 p-3 rounded-2xl ${
                      isMe ? 'bg-amber-500/15 border border-amber-500/30' : 'bg-white/5'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${
                      isRoomHost ? 'bg-amber-600' : 'bg-emerald-700'
                    }`}>
                      {playerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">
                        {playerName} {isMe && <span className="text-amber-400 text-xs">(sen)</span>}
                      </p>
                      {isRoomHost && <p className="text-amber-500 text-xs">Host</p>}
                    </div>
                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full shadow-[0_0_8px_#4ade80]" />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Empty slots */}
            {[...Array(emptySlots)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-dashed border-white/8">
                <div className="w-11 h-11 rounded-full border-2 border-dashed border-white/15 flex items-center justify-center">
                  <span className="text-white/20 text-xl">?</span>
                </div>
                <p className="text-white/20 text-sm">Bekleniyor...</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="flex gap-3">
          <button onClick={() => { leaveRoom(code!, user!.uid); navigate('/'); }} className="btn-ghost flex-1 py-4">
            ← Çık
          </button>
          {isHost ? (
            <button onClick={handleStartGame} disabled={starting || !canStart} className="btn-primary flex-[2] py-4 text-lg">
              {starting
                ? <><span className="spinner" /> Başlıyor...</>
                : room.playerUids.length < 2
                  ? '👤 En az 2 oyuncu gerekli'
                  : '▶ Oyunu Başlat'
              }
            </button>
          ) : (
            <div className="flex-[2] flex items-center justify-center py-4 px-4 rounded-2xl bg-white/5 border border-white/8">
              <p className="text-emerald-500 text-sm text-center">⏳ Host başlatmasını bekle</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
