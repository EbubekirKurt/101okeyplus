import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createInitialGameState,
  getNextPlayer,
  getLeftOpponentUid,
  canOpenMelds,
  canOpenFivePairs,
  isThrewOkey,
  calculateRoundPenalties,
  effectiveMinOpenPoints,
  effectiveMinOpenPairCount,
  nextMinOpenPointsAfterMeldOpen,
  nextMinOpenPairCountAfterPairOpen,
} from '../../lib/engine/gameEngine';
import { peekNextDrawFromPile } from '../../lib/engine/deal';
import { getBotDiscard } from '../../lib/bot/botStrategy';
import {
  totalMeldPoints,
  validateRun,
  validateGroup,
  orderRunTilesForDisplay,
  orderGroupTilesForDisplay,
} from '../../lib/melds/validateMeld';
import { isOkey } from '../../lib/tiles/okey';
import { PENALTY } from '../../lib/scoring/scoreHand';
import { appendMove, savePrivateHand, updateGame, getPrivateHand } from '../../services/firebase/games';
import { MoveType } from '../../types/game';
import { Meld } from '../../types/meld';
import { Tile } from '../../types/tile';
import { useAuth } from '../../hooks/useAuth';
import { useGame, useHand } from '../../hooks/useGame';
import { usePresence } from '../../hooks/usePresence';
import { useUIStore } from '../../state/store';
import { GameTable } from './GameTable';
import { RoundEndModal } from './RoundEndModal';
import { ScoreBoard } from './ScoreBoard';

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading } = useGame(gameId || null);
  const hand = useHand(gameId || null, user?.uid || null);
  const [showScores, setShowScores] = useState(false);
  const { clearSelection } = useUIStore();
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardInFlightRef = useRef(false);
  const returnPickInFlightRef = useRef(false);

  usePresence(gameId || null, user?.uid || null);

  const isMyTurn = game?.currentTurnUid === user?.uid;
  const myPlayer = game?.players[user?.uid || ''];

  // ── Bot: host drives bots for disconnected players ──
  useEffect(() => {
    if (!game || !user || game.phase === 'round_end' || game.phase === 'game_over') return;
    if (!myPlayer?.isHost) return;
    const current = game.players[game.currentTurnUid];
    if (!current || current.connected !== false) return;
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    botTimerRef.current = setTimeout(() => runBotTurn(game.currentTurnUid), 2500);
    return () => { if (botTimerRef.current) clearTimeout(botTimerRef.current); };
  }, [game?.currentTurnUid, game?.phase, game?.version]);

  async function runBotTurn(botUid: string) {
    if (!game || !gameId) return;
    const botHand = await getPrivateHand(gameId, botUid);
    if (game.phase === 'awaiting_draw') {
      const nextTile = peekNextDrawFromPile(game);
      if (!nextTile) return;
      const newBotHand = [...botHand, nextTile];
      await appendMove(gameId, { type: 'draw_from_pile', by: botUid, ts: Date.now() });
      await savePrivateHand(gameId, botUid, newBotHand);
      await updateGame(gameId, {
        phase: 'awaiting_discard',
        drawPileCount: Math.max(0, game.drawPileCount - 1),
        [`players.${botUid}.handCount`]: newBotHand.length,
        mustOpenFromDiscard: null,
        lastMoveAt: Date.now(), version: game.version + 1,
      });
    } else if (game.phase === 'awaiting_discard') {
      if (!botHand.length) return;
      const discard = getBotDiscard(botHand, game.indicator!);
      const newHand = botHand.filter(t => t.id !== discard.id);
      const newPile = [...(game.discardPiles[botUid] || []), discard];
      const nextUid = getNextPlayer(game.turnOrder, botUid, game.players);
      const newCount = Math.max(0, game.drawPileCount);
      await appendMove(gameId, { type: 'discard', by: botUid, tileId: discard.id, ts: Date.now() });
      await savePrivateHand(gameId, botUid, newHand);
      await updateGame(gameId, {
        phase: newCount === 0 ? 'round_end' : 'awaiting_draw',
        currentTurnUid: nextUid,
        turnDeadline: Date.now() + 90000,
        [`discardPiles.${botUid}`]: newPile,
        [`players.${botUid}.handCount`]: newHand.length,
        drawPileEmpty: newCount === 0,
        mustOpenFromDiscard: null,
        lastMoveAt: Date.now(), version: game.version + 1,
      });
    }
  }

  async function handleDrawFromPile() {
    console.log('[drawPile] attempt', { phase: game?.phase, isMyTurn, uid: user?.uid, turn: game?.currentTurnUid, drawPileCount: game?.drawPileCount });
    if (!game || !user || !isMyTurn || game.phase !== 'awaiting_draw') {
      console.warn('[drawPile] blocked', { game: !!game, user: !!user, isMyTurn, phase: game?.phase });
      return;
    }
    if (game.drawPileCount <= 0) {
      await updateGame(game.id, { phase: 'round_end', drawPileEmpty: true, lastMoveAt: Date.now() });
      return;
    }
    const nextTile = peekNextDrawFromPile(game);
    if (!nextTile) {
      toast.error('Bankadan taş alınamadı');
      return;
    }
    const newHand = [...hand, nextTile];
    await appendMove(game.id, { type: 'draw_from_pile', by: user.uid, ts: Date.now() });
    await savePrivateHand(game.id, user.uid, newHand);
    await updateGame(game.id, {
      phase: 'awaiting_discard',
      drawPileCount: game.drawPileCount - 1,
      [`players.${user.uid}.handCount`]: newHand.length,
      mustOpenFromDiscard: null,
      lastMoveAt: Date.now(), version: game.version + 1,
    });
    toast('Taş çekildi', { icon: '🀄' });
  }

  async function handleDrawFromDiscard(fromUid: string) {
    if (!game || !user || !isMyTurn || game.phase !== 'awaiting_draw') return;
    const allowedLeft = getLeftOpponentUid(game.turnOrder, user.uid);
    if (fromUid !== allowedLeft) {
      toast.error('Sadece soldaki rakibin attığı taşı alabilirsin');
      return;
    }
    const pile = game.discardPiles[fromUid];
    if (!pile?.length) return;
    const tile = pile[pile.length - 1];
    const newPile = pile.slice(0, -1);
    const newHand = [...hand, tile];
    await appendMove(game.id, { type: 'draw_from_discard', by: user.uid, fromUid, tileId: tile.id, ts: Date.now() });
    await savePrivateHand(game.id, user.uid, newHand);
    await updateGame(game.id, {
      phase: 'awaiting_discard',
      [`discardPiles.${fromUid}`]: newPile,
      [`players.${user.uid}.handCount`]: newHand.length,
      mustOpenFromDiscard: { pickerUid: user.uid, fromUid, tileId: tile.id },
      lastMoveAt: Date.now(), version: game.version + 1,
    });
  }

  /** Soldan alınan taşı geri koy + bankadan bir taş çek (açamıyorsan). */
  async function handleReturnDiscardDrawPile() {
    if (returnPickInFlightRef.current) return;
    if (!game || !user || !isMyTurn || game.phase !== 'awaiting_discard') return;
    const mo = game.mustOpenFromDiscard;
    if (!mo || mo.pickerUid !== user.uid) {
      toast.error('Bu işlem sadece soldan taş aldıktan sonra kullanılabilir');
      return;
    }
    const tile = hand.find(t => t.id === mo.tileId);
    if (!tile) return;
    if (game.drawPileCount <= 0) {
      toast.error('Bankada taş yok');
      return;
    }
    const bankTile = peekNextDrawFromPile(game);
    if (!bankTile) {
      toast.error('Bankadan taş alınamadı');
      return;
    }
    returnPickInFlightRef.current = true;
    try {
      const restoredPile = [...(game.discardPiles[mo.fromUid] || []), tile];
      const newHand = [...hand.filter(t => t.id !== mo.tileId), bankTile];
      await appendMove(game.id, {
        type: 'return_discard_draw_pile',
        by: user.uid,
        fromUid: mo.fromUid,
        returnedTileId: mo.tileId,
        ts: Date.now(),
      });
      await savePrivateHand(game.id, user.uid, newHand);
      await updateGame(game.id, {
        mustOpenFromDiscard: null,
        [`discardPiles.${mo.fromUid}`]: restoredPile,
        drawPileCount: game.drawPileCount - 1,
        [`players.${user.uid}.handCount`]: newHand.length,
        lastMoveAt: Date.now(), version: game.version + 1,
      });
      toast('Taş iade edildi, bankadan çekildi', { icon: '🀄' });
    } finally {
      returnPickInFlightRef.current = false;
    }
  }

  async function handleDiscard(tileId: string) {
    if (discardInFlightRef.current) return;
    if (!game || !user || !isMyTurn || game.phase !== 'awaiting_discard') return;
    const tile = hand.find(t => t.id === tileId);
    if (!tile) return;

    const mo = game.mustOpenFromDiscard;
    if (mo && mo.pickerUid === user.uid && hand.some(t => t.id === mo.tileId)) {
      toast.error('Soldan aldığın taşla önce seri veya çift açmalısın — yoksa «Geri Ver» ile iade edip bankadan çek.');
      return;
    }

    discardInFlightRef.current = true;
    try {
    // Check okey penalty
    const threwOkey = isThrewOkey(tileId, hand, game.indicator!);
    if (threwOkey) {
      // Apply 101-point penalty to self
      const newScore = (myPlayer?.totalScore ?? 0) + PENALTY.THREW_OKEY;
      toast.error(`Okey attın! +${PENALTY.THREW_OKEY} ceza puanı`, { duration: 4000 });
      await updateGame(game.id, {
        [`players.${user.uid}.totalScore`]: newScore,
        [`players.${user.uid}.eliminated`]: newScore >= 1000, // high threshold for elimination in 101
      });
    }

    const newHand = hand.filter(t => t.id !== tileId);
    const newPile = [...(game.discardPiles[user.uid] || []), tile];
    const nextUid = getNextPlayer(game.turnOrder, user.uid, game.players);

    await appendMove(game.id, { type: 'discard', by: user.uid, tileId, penaltyForOkey: threwOkey, ts: Date.now() });
    await savePrivateHand(game.id, user.uid, newHand);
    await updateGame(game.id, {
      phase: 'awaiting_draw',
      currentTurnUid: nextUid,
      turnDeadline: Date.now() + 90000,
      [`discardPiles.${user.uid}`]: newPile,
      [`players.${user.uid}.handCount`]: newHand.length,
      islek: null,
      mustOpenFromDiscard: null,
      lastMoveAt: Date.now(), version: game.version + 1,
    });
    clearSelection();
    } finally {
      discardInFlightRef.current = false;
    }
  }

  // Regular meld opening — must total >= 101 points (birden fazla per tek hamlede olabilir)
  async function handleOpenMelds(melds: Meld[]): Promise<boolean> {
    if (!game || !user || !isMyTurn) return false;
    if (game.players[user.uid]?.hasOpened) {
      toast.error('Elini zaten açtın');
      return false;
    }

    const minPts = effectiveMinOpenPoints(game);
    const check = canOpenMelds(melds, game.indicator!, hand, minPts);
    if (!check.valid) { toast.error(check.reason ?? 'Geçersiz açılış'); return false; }

    const usedIds = new Set(melds.flatMap(m => m.tiles.map(t => t.id)));
    const mo = game.mustOpenFromDiscard;
    if (mo && mo.pickerUid === user.uid && !usedIds.has(mo.tileId)) {
      toast.error('Soldan aldığın taşı açılışa dahil etmelisin');
      return false;
    }
    const newHand = hand.filter(t => !usedIds.has(t.id));
    const points = totalMeldPoints(melds, game.indicator!);

    try {
      await appendMove(game.id, { type: 'open_melds', by: user.uid, melds, ts: Date.now() });
      await savePrivateHand(game.id, user.uid, newHand);
      await updateGame(game.id, {
        melds: [...game.melds, ...melds],
        [`players.${user.uid}.hasOpened`]: true,
        [`players.${user.uid}.handCount`]: newHand.length,
        minOpenPoints: nextMinOpenPointsAfterMeldOpen(points),
        ...(mo && mo.pickerUid === user.uid && usedIds.has(mo.tileId) ? { mustOpenFromDiscard: null } : {}),
        lastMoveAt: Date.now(),
        version: game.version + 1,
      });
    } catch {
      toast.error('Açılış kaydedilemedi, tekrar dene');
      return false;
    }
    toast.success(`El açıldı! ${points} puan ✓`);
    return true;
  }

  /** Açtıktan sonra eldeki geçerli yeni per(ler)i masaya ekle (min puan şartı yok). */
  async function handleLayAdditionalMelds(melds: Meld[]): Promise<boolean> {
    if (!game || !user || !isMyTurn || game.phase !== 'awaiting_discard') return false;
    if (!game.players[user.uid]?.hasOpened) {
      toast.error('Önce elini açmalısın');
      return false;
    }
    const check = canOpenMelds(melds, game.indicator!, hand, 0);
    if (!check.valid) {
      toast.error(check.reason ?? 'Geçersiz per');
      return false;
    }
    const usedIds = new Set(melds.flatMap(m => m.tiles.map(t => t.id)));
    const mo = game.mustOpenFromDiscard;
    if (mo && mo.pickerUid === user.uid && !usedIds.has(mo.tileId)) {
      toast.error('Soldan aldığın taşı yeni perde kullanmalısın');
      return false;
    }
    const newHand = hand.filter(t => !usedIds.has(t.id));
    try {
      await appendMove(game.id, { type: 'lay_melds', by: user.uid, melds, ts: Date.now() });
      await savePrivateHand(game.id, user.uid, newHand);
      await updateGame(game.id, {
        melds: [...game.melds, ...melds],
        [`players.${user.uid}.handCount`]: newHand.length,
        ...(mo && mo.pickerUid === user.uid && usedIds.has(mo.tileId) ? { mustOpenFromDiscard: null } : {}),
        lastMoveAt: Date.now(),
        version: game.version + 1,
      });
    } catch {
      toast.error('Kaydedilemedi, tekrar dene');
      return false;
    }
    toast.success('Per masaya eklendi');
    return true;
  }

  async function handleOpenFivePairs(tiles: Tile[]): Promise<boolean> {
    if (!game || !user || !isMyTurn) return false;
    if (game.players[user.uid]?.hasOpened) {
      toast.error('Elini zaten açtın');
      return false;
    }
    const minPairs = effectiveMinOpenPairCount(game);
    const check = canOpenFivePairs(tiles, game.indicator!, hand, minPairs);
    if (!check.valid) { toast.error(check.reason ?? 'Geçersiz çift açma'); return false; }

    const usedIds = new Set(tiles.map(t => t.id));
    const mo = game.mustOpenFromDiscard;
    if (mo && mo.pickerUid === user.uid && !usedIds.has(mo.tileId)) {
      toast.error(`Soldan aldığın taşı ${minPairs} çift açılışına dahil etmelisin`);
      return false;
    }
    const newHand = hand.filter(t => !usedIds.has(t.id));

    try {
      await appendMove(game.id, { type: 'open_five_pairs', by: user.uid, tiles, ts: Date.now() });
      await savePrivateHand(game.id, user.uid, newHand);
      await updateGame(game.id, {
        [`players.${user.uid}.hasOpened`]: true,
        [`players.${user.uid}.handCount`]: newHand.length,
        minOpenPairCount: nextMinOpenPairCountAfterPairOpen(minPairs),
        ...(mo && mo.pickerUid === user.uid && usedIds.has(mo.tileId) ? { mustOpenFromDiscard: null } : {}),
        lastMoveAt: Date.now(),
        version: game.version + 1,
      });
    } catch {
      toast.error('Açılış kaydedilemedi, tekrar dene');
      return false;
    }
    toast.success(`${minPairs} çift açıldı ✓`);
    return true;
  }

  async function handleExtendMeld(meldId: string, tileIds: string[]) {
    if (!game || !user || !game.indicator) return;
    if (!isMyTurn || game.phase !== 'awaiting_discard') return;
    if (!game.players[user.uid]?.hasOpened) {
      toast.error('Önce elini açmalısın');
      return;
    }
    if (tileIds.length === 0) {
      toast.error('Taş seç');
      return;
    }
    const meld = game.melds.find(m => m.id === meldId);
    if (!meld) return;
    if (meld.ownerId !== user.uid) {
      toast.error('Sadece kendi perlerine taş ekleyebilirsin');
      return;
    }
    const ind = game.indicator;
    const tiles = hand.filter(t => tileIds.includes(t.id));
    if (tiles.length !== tileIds.length) {
      toast.error('Seçilen taşlar elinde bulunamadı');
      return;
    }
    const merged = [...meld.tiles, ...tiles];

    let ordered: Tile[];
    if (meld.type === 'run') {
      if (!validateRun(merged, ind)) {
        toast.error('Bu taşlar bu seriyle aynı renkte ardışık sayı olarak birleşemez');
        return;
      }
      const runOrdered = orderRunTilesForDisplay(merged, ind);
      if (!runOrdered) {
        toast.error('Seri sıralanamadı');
        return;
      }
      ordered = runOrdered;
    } else {
      if (!validateGroup(merged, ind)) {
        toast.error('Bu taşlar bu grupla birleşemez');
        return;
      }
      const groupOrdered = orderGroupTilesForDisplay(merged, ind);
      if (!groupOrdered) {
        toast.error('Grup sıralanamadı');
        return;
      }
      ordered = groupOrdered;
    }

    const newMelds = game.melds.map(m => (m.id === meldId ? { ...m, tiles: ordered } : m));
    const newHand = hand.filter(t => !tileIds.includes(t.id));
    const mo = game.mustOpenFromDiscard;
    const clearMo = mo && mo.pickerUid === user.uid && tileIds.includes(mo.tileId);
    try {
      await appendMove(game.id, { type: 'extend_meld', by: user.uid, meldId, tileIds, ts: Date.now() });
      await savePrivateHand(game.id, user.uid, newHand);
      await updateGame(game.id, {
        melds: newMelds,
        [`players.${user.uid}.handCount`]: newHand.length,
        ...(clearMo ? { mustOpenFromDiscard: null } : {}),
        lastMoveAt: Date.now(),
        version: game.version + 1,
      });
    } catch {
      toast.error('Kaydedilemedi, tekrar dene');
      return;
    }
    toast.success('Taş işlendi!');
  }

  async function handleDeclareFinish(finishMelds: Meld[]) {
    if (!game || !user) return;
    await appendMove(game.id, { type: 'declare_finish', by: user.uid, melds: finishMelds, ts: Date.now() });
    await updateGame(game.id, { phase: 'round_end', winnerId: user.uid, lastMoveAt: Date.now() });
    toast.success('🏆 Tebrikler! Elini bitirdin!', { duration: 5000 });
  }

  async function handleNextRound() {
    if (!game || !myPlayer?.isHost) return;
    const active = Object.values(game.players).filter(p => !p.eliminated);
    if (active.length < 2) { await updateGame(game.id, { phase: 'game_over' }); return; }

    const newSeed = Math.floor(Math.random() * 2 ** 32);
    const newOrder = [...game.turnOrder.slice(1), game.turnOrder[0]];
    const { gameState, hands } = createInitialGameState(
      game.id, game.roomId, newOrder,
      Object.fromEntries(Object.entries(game.players).map(([uid, p]) => [uid, p.displayName])),
      Object.values(game.players).find(p => p.isHost)?.uid || newOrder[0],
      newSeed,
    );
    gameState.roundNumber = game.roundNumber + 1;

    // Carry over scores
    for (const uid of newOrder) {
      const old = game.players[uid];
      if (!old) continue;
      gameState.players[uid].totalScore = old.totalScore + (old.roundScore ?? 0);
      gameState.players[uid].isHost = old.isHost;
    }

    await updateGame(game.id, { ...gameState } as any);
    for (const [uid, tiles] of Object.entries(hands)) {
      await savePrivateHand(game.id, uid, tiles);
    }
    toast('🎲 Yeni tur başladı!');
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-felt">
      <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!game || !user) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-felt gap-4">
      <p className="text-red-400 text-xl">Oyun bulunamadı</p>
      <button onClick={() => navigate('/')} className="btn-secondary px-6 py-3">← Ana Sayfa</button>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: '#0f1510' }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between gap-3 flex-shrink-0 px-3 sm:px-4 py-3 min-h-[58px]"
        style={{ background: 'rgba(0,0,0,0.82)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          className="shrink-0 rounded-lg border border-amber-900/40 bg-amber-950/30 px-4 py-2.5 text-base font-semibold text-amber-100 hover:bg-amber-900/40 hover:text-white transition-colors ml-6"
        >
          ← Çık
        </button>
        <div className="flex min-w-0 flex-col items-center justify-center px-2 text-center">
          <span className="truncate font-black tracking-tight text-amber-400 text-lg sm:text-xl max-w-[56vw]">
            101 Okey Plus
          </span>
          <span className="text-sm font-medium text-neutral-500">Tur {game.roundNumber}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowScores(s => !s)}
          className="shrink-0 rounded-lg border border-amber-900/40 bg-amber-950/30 px-4 py-2.5 text-base font-semibold text-amber-100 hover:bg-amber-900/40 hover:text-white transition-colors"
        >
          📊 Skor
        </button>
      </div>

      {/* Table — kalan tüm dikey alanı doldurur (altta siyah şerit kalmaz) */}
      <div className="flex flex-1 flex-col min-h-0 px-1 pb-1 pt-0 sm:px-2 sm:pb-2">
        <div
          className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl"
          style={{ boxShadow: '0 0 0 4px #3d2008, 0 0 0 7px #1f1004, 0 0 40px rgba(0,0,0,0.8)' }}
        >
          <GameTable
            game={game} myUid={user.uid} hand={hand}
            onDrawFromPile={handleDrawFromPile}
            onDrawFromDiscard={handleDrawFromDiscard}
            onReturnDiscardDrawPile={handleReturnDiscardDrawPile}
            onDiscard={handleDiscard}
            onOpenMelds={handleOpenMelds}
            onLayAdditionalMelds={handleLayAdditionalMelds}
            onOpenFivePairs={handleOpenFivePairs}
            onExtendMeld={handleExtendMeld}
            onDeclareFinish={handleDeclareFinish}
          />
        </div>
      </div>

      {/* Score overlay */}
      <AnimatePresence>
        {showScores && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4"
            onClick={() => setShowScores(false)}>
            <div onClick={e => e.stopPropagation()}>
              <ScoreBoard game={game} onClose={() => setShowScores(false)} />
            </div>
          </div>
        )}
      </AnimatePresence>

      {game.phase === 'round_end' && (
        <RoundEndModal game={game} myUid={user.uid} onNextRound={handleNextRound} />
      )}

      {game.phase === 'game_over' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="card text-center max-w-sm w-full">
            <div className="text-7xl mb-4">🏆</div>
            <h2 className="text-amber-300 font-black text-3xl mb-2">Oyun Bitti!</h2>
            {game.winnerId && (
              <p className="text-white text-xl mb-6">
                <span className="text-amber-400 font-bold">{game.players[game.winnerId]?.displayName}</span> kazandı!
              </p>
            )}
            <button onClick={() => navigate('/')} className="btn-primary w-full py-4 text-lg">Ana Menüye Dön</button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
