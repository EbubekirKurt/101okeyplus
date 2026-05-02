import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getSavedName, registerUser } from '../../services/firebase/auth';
import { createRoom, joinRoom } from '../../services/firebase/rooms';
import { useAuth } from '../../hooks/useAuth';

type Screen = 'loading' | 'register' | 'menu' | 'create' | 'join';

export function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('loading');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(4);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    const saved = getSavedName();
    if (user && saved) {
      setScreen('menu');
    } else {
      setScreen('register');
    }
  }, [loading, user]);

  async function handleRegister() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) { toast.error('En az 2 karakter gir'); return; }
    if (trimmed.length > 16) { toast.error('En fazla 16 karakter'); return; }
    setBusy(true);
    try {
      await registerUser(trimmed);
      setScreen('menu');
      toast.success(`Hoş geldin, ${trimmed}!`);
    } catch {
      toast.error('Kayıt başarısız, tekrar dene');
    }
    setBusy(false);
  }

  async function handleCreateRoom() {
    // displayName might lag behind auth state update — read from localStorage as fallback
    const displayName = user?.displayName || getSavedName();
    if (!user || !displayName) {
      toast.error('Kullanıcı adı bulunamadı, tekrar giriş yap');
      setScreen('register');
      return;
    }
    setBusy(true);
    try {
      const room = await createRoom(user.uid, displayName, maxPlayers);
      navigate(`/room/${room.id}`);
    } catch (e: any) {
      console.error('createRoom error:', e);
      const msg = e?.code === 'permission-denied'
        ? 'Firebase izni yok — Firestore kurallarını kontrol et'
        : e?.message || 'Oda oluşturulamadı';
      toast.error(msg);
    }
    setBusy(false);
  }

  async function handleJoinRoom() {
    const displayName = user?.displayName || getSavedName();
    if (!user || !displayName) { setScreen('register'); return; }
    if (joinCode.length !== 6) { toast.error('6 haneli kodu gir'); return; }
    setBusy(true);
    try {
      await joinRoom(joinCode.toUpperCase(), user.uid, displayName);
      navigate(`/room/${joinCode.toUpperCase()}`);
    } catch (e: any) {
      console.error('joinRoom error:', e);
      const msg = e?.code === 'permission-denied'
        ? 'Firebase izni yok — Firestore kurallarını kontrol et'
        : e?.message || 'Odaya girilemedi';
      toast.error(msg);
    }
    setBusy(false);
  }

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-felt">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-felt overflow-hidden relative px-4">
      {/* Background tiles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {['♦', '♠', '♣', '♥', '🀄'].map((sym, i) =>
          [...Array(4)].map((_, j) => (
            <motion.span
              key={`${i}-${j}`}
              className="absolute text-white/5 text-6xl select-none"
              style={{ left: `${(i * 20 + j * 7) % 90}%`, top: `${(i * 17 + j * 13 + 5) % 85}%` }}
              animate={{ rotate: [0, 360], scale: [1, 1.1, 1] }}
              transition={{ duration: 15 + i * 4, repeat: Infinity, ease: 'linear', delay: j * 2 }}
            >
              {sym}
            </motion.span>
          ))
        )}
      </div>

      {/* Logo */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 text-center mb-10"
      >
        <div className="text-8xl mb-4 drop-shadow-2xl">🎴</div>
        <h1 className="text-6xl font-black text-amber-400 tracking-tight" style={{ textShadow: '0 0 40px rgba(251,191,36,0.4), 0 4px 8px rgba(0,0,0,0.5)' }}>
          101 Okey
        </h1>
        <p className="text-emerald-400 text-lg mt-2 font-medium">Türk Okey • 2-4 Oyuncu</p>
      </motion.div>

      <motion.div
        key={screen}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* ── REGISTER ── */}
        {screen === 'register' && (
          <div className="card">
            <h2 className="text-amber-300 font-bold text-2xl text-center mb-1">Kullanıcı Adı Seç</h2>
            <p className="text-emerald-500 text-sm text-center mb-6">Tarayıcında saklanır, tekrar girmen gerekmez</p>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              placeholder="İsmin..."
              maxLength={16}
              className="input w-full mb-4"
            />
            <button onClick={handleRegister} disabled={busy || name.trim().length < 2} className="btn-primary w-full">
              {busy ? <span className="spinner" /> : 'Kayıt Ol & Başla'}
            </button>
          </div>
        )}

        {/* ── MENU ── */}
        {screen === 'menu' && (
          <div className="space-y-3">
            <div className="text-center mb-6">
              <p className="text-emerald-400">Hoş geldin,</p>
              <p className="text-amber-300 font-bold text-2xl">{user?.displayName}</p>
              <button
                onClick={() => { setName(user?.displayName || ''); setScreen('register'); }}
                className="text-emerald-700 hover:text-emerald-500 text-xs underline mt-1"
              >
                ismi değiştir
              </button>
            </div>
            <button onClick={() => setScreen('create')} className="btn-primary w-full py-5 text-xl">
              🎮 Oda Oluştur
            </button>
            <button onClick={() => setScreen('join')} className="btn-secondary w-full py-5 text-xl">
              🔑 Odaya Katıl
            </button>
          </div>
        )}

        {/* ── CREATE ROOM ── */}
        {screen === 'create' && (
          <div className="card">
            <h2 className="text-amber-300 font-bold text-xl text-center mb-6">Oda Oluştur</h2>
            <label className="text-emerald-400 text-sm mb-2 block">Maksimum Oyuncu</label>
            <div className="flex gap-2 mb-6">
              {([2, 3, 4] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setMaxPlayers(n)}
                  className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all ${
                    maxPlayers === n
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                      : 'bg-white/5 text-emerald-400 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {n} kişi
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setScreen('menu')} className="btn-ghost flex-1">Geri</button>
              <button onClick={handleCreateRoom} disabled={busy} className="btn-primary flex-1">
                {busy ? <span className="spinner" /> : 'Oluştur'}
              </button>
            </div>
          </div>
        )}

        {/* ── JOIN ROOM ── */}
        {screen === 'join' && (
          <div className="card">
            <h2 className="text-amber-300 font-bold text-xl text-center mb-2">Odaya Katıl</h2>
            <p className="text-emerald-500 text-sm text-center mb-6">Arkadaşından aldığın 6 haneli kodu gir</p>
            <input
              autoFocus
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
              placeholder="XXXXXX"
              maxLength={6}
              className="input w-full text-center text-3xl font-mono tracking-[0.5em] uppercase mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setScreen('menu')} className="btn-ghost flex-1">Geri</button>
              <button onClick={handleJoinRoom} disabled={busy || joinCode.length !== 6} className="btn-primary flex-1">
                {busy ? <span className="spinner" /> : 'Katıl'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
