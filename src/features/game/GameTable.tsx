import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { detectMeldType, totalMeldPoints } from '../../lib/melds/validateMeld';
import { MIN_OPEN_POINTS } from '../../lib/engine/gameEngine';
import { detectLiveMelds, seriDiz, ciftDiz } from '../../lib/auto-arrange';
import { GameState } from '../../types/game';
import { Meld } from '../../types/meld';
import { Tile } from '../../types/tile';
import { useUIStore } from '../../state/store';
import { MeldArea } from './MeldArea';
import { PlayerHand } from './PlayerHand';
import { TileComponent } from '../tile/Tile';

// ── Mini tile icons for action buttons ────────────────────────────────────
function TileIcon({ nums, colors }: { nums: number[]; colors: string[] }) {
  return (
    <div className="flex gap-px flex-shrink-0">
      {nums.map((n, i) => (
        <div key={i} style={{
          width: 16, height: 22,
          background: 'linear-gradient(160deg, #fefce8, #fef3c7)',
          border: '1px solid #d0c090', borderRadius: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }}>
          <span style={{ color: colors[i] ?? colors[0], fontWeight: 900, fontSize: 8, lineHeight: 1 }}>{n}</span>
        </div>
      ))}
    </div>
  );
}

// ── Side player (left / right) ────────────────────────────────────────────
function SidePlayer({ uid, game }: { uid: string | undefined; game: GameState }) {
  if (!uid) return <div style={{ width: 80 }} />;
  const p = game.players[uid];
  if (!p) return <div style={{ width: 80 }} />;
  const isActive = game.currentTurnUid === uid;
  const count = Math.min(p.handCount ?? 0, 14);
  const half = Math.ceil(count / 2);

  return (
    <div style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 0' }}>
      {/* Top tile stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[...Array(half)].map((_, i) => (
          <div key={i} style={{ width: 32, height: 7, borderRadius: 2, background: 'linear-gradient(90deg, #7c5c3a, #4a3520)', border: '1px solid #5a4030' }} />
        ))}
      </div>

      {/* Avatar */}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          border: `2px solid ${isActive ? '#facc15' : '#4b5563'}`,
          background: 'linear-gradient(135deg, #374151, #1f2937)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 900, fontSize: 18,
          boxShadow: isActive ? '0 0 10px rgba(250,204,21,0.5)' : undefined,
        }}>
          {p.displayName.charAt(0).toUpperCase()}
          {!p.connected && (
            <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', borderRadius: '50%', width: 14, height: 14, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>🤖</span>
          )}
        </div>
      </div>

      {/* Name badge */}
      <div style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '2px 6px', textAlign: 'center', width: '100%' }}>
        <p style={{ color: 'white', fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</p>
        <p style={{ color: '#9ca3af', fontSize: 10 }}>{p.totalScore}p</p>
        {p.hasOpened && <p style={{ color: '#4ade80', fontSize: 9 }}>✓ Açtı</p>}
      </div>

      {/* Bottom tile stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[...Array(count - half)].map((_, i) => (
          <div key={i} style={{ width: 32, height: 7, borderRadius: 2, background: 'linear-gradient(90deg, #7c5c3a, #4a3520)', border: '1px solid #5a4030' }} />
        ))}
      </div>
    </div>
  );
}

// ── Top player badge ──────────────────────────────────────────────────────
function TopPlayer({ uid, game }: { uid: string | undefined; game: GameState }) {
  if (!uid) return null;
  const p = game.players[uid];
  if (!p) return null;
  const isActive = game.currentTurnUid === uid;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
      <motion.div
        animate={isActive ? { scale: [1, 1.02, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 16px', borderRadius: 12,
          background: 'rgba(0,0,0,0.65)',
          border: `1px solid ${isActive ? 'rgba(250,204,21,0.5)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: isActive ? '0 0 12px rgba(250,204,21,0.2)' : undefined,
        }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `2px solid ${isActive ? '#facc15' : '#4b5563'}`,
          background: 'linear-gradient(135deg, #374151, #1f2937)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 900, fontSize: 15,
        }}>
          {p.displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{p.displayName}</p>
          <p style={{ color: '#9ca3af', fontSize: 11 }}>🀄 {p.handCount} &nbsp; {p.totalScore}p {p.hasOpened ? '✓' : '—'}</p>
        </div>
      </motion.div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────
interface GameTableProps {
  game: GameState;
  myUid: string;
  hand: Tile[];
  onDrawFromPile: () => void;
  onDrawFromDiscard: (fromUid: string) => void;
  onDiscard: (tileId: string) => void;
  onOpenMelds: (melds: Meld[]) => void;
  onOpenFivePairs: (tiles: Tile[]) => void;
  onExtendMeld: (meldId: string, tileIds: string[]) => void;
  onDeclareFinish: (melds: Meld[]) => void;
}

export function GameTable({
  game, myUid, hand,
  onDrawFromPile, onDrawFromDiscard, onDiscard,
  onOpenMelds, onOpenFivePairs, onExtendMeld, onDeclareFinish,
}: GameTableProps) {
  const { selectedTileIds, toggleTileSelection, clearSelection } = useUIStore();
  const [tilesOrder, setTilesOrder] = useState<Tile[]>(hand);
  const [timeLeft, setTimeLeft] = useState(90);

  const isMyTurn = game.currentTurnUid === myUid;
  const myPlayer = game.players[myUid];
  const canDraw = isMyTurn && game.phase === 'awaiting_draw';
  const canDiscard = isMyTurn && game.phase === 'awaiting_discard';
  const myScore = myPlayer?.totalScore ?? 0;

  const others = game.turnOrder.filter(u => u !== myUid);
  const topUid = others[0];
  const leftUid = others[1];
  const rightUid = others[2];

  useEffect(() => {
    setTilesOrder(prev => {
      const prevIds = new Set(prev.map(t => t.id));
      const newIds = new Set(hand.map(t => t.id));
      return [...prev.filter(t => newIds.has(t.id)), ...hand.filter(t => !prevIds.has(t.id))];
    });
  }, [hand]);

  useEffect(() => {
    if (!game.turnDeadline) return;
    const iv = setInterval(() => setTimeLeft(Math.max(0, Math.ceil((game.turnDeadline! - Date.now()) / 1000))), 500);
    return () => clearInterval(iv);
  }, [game.turnDeadline]);

  function handleDiscardSelected() {
    if (selectedTileIds.size !== 1) { toast.error('Atmak için 1 taş seç'); return; }
    const [id] = selectedTileIds;
    clearSelection();
    onDiscard(id);
  }

  function handleOpenSelected() {
    if (selectedTileIds.size < 3) { toast.error('En az 3 taş seç'); return; }
    const tiles = tilesOrder.filter(t => selectedTileIds.has(t.id));
    const type = detectMeldType(tiles, game.indicator!);
    if (!type) { toast.error('Geçerli seri/grup değil'); return; }
    clearSelection();
    onOpenMelds([{ id: `${myUid}-${Date.now()}`, type, tiles, ownerId: myUid }]);
  }

  function handleFivePairs() {
    const tiles = tilesOrder.filter(t => selectedTileIds.has(t.id));
    if (tiles.length !== 10) { toast.error('5 çift için tam 10 taş seç'); return; }
    clearSelection();
    onOpenFivePairs(tiles);
  }

  function handleSeriDiz() {
    if (!game.indicator) return;
    setTilesOrder(seriDiz(tilesOrder, game.indicator));
  }

  function handleCiftDiz() {
    if (!game.indicator) return;
    setTilesOrder(ciftDiz(tilesOrder, game.indicator));
  }

  // Live detection
  const selectedTiles = tilesOrder.filter(t => selectedTileIds.has(t.id));
  const previewType = selectedTiles.length >= 3 && game.indicator ? detectMeldType(selectedTiles, game.indicator) : null;
  const previewPoints = previewType && game.indicator ? totalMeldPoints([{ tiles: selectedTiles }], game.indicator) : 0;
  const myMeldPoints = game.melds.filter(m => m.ownerId === myUid).reduce((s, m) => s + (game.indicator ? totalMeldPoints([m], game.indicator) : 0), 0);
  const liveMelds = game.indicator ? detectLiveMelds(tilesOrder, game.indicator) : null;
  const livePoints = liveMelds?.totalPoints ?? 0;
  const meldGroupByTileId = new Map<string, number>();
  if (liveMelds) {
    liveMelds.melds.forEach((meld, gi) => {
      meld.indices.forEach(idx => { if (tilesOrder[idx]) meldGroupByTileId.set(tilesOrder[idx].id, gi); });
    });
  }

  // 4-quadrant discard table: [me, right, top, left]
  const quadrantUids = [myUid, rightUid, topUid, leftUid].filter(Boolean) as string[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1a5c32', overflow: 'hidden' }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button style={{ color: '#facc15', fontSize: 18, lineHeight: 1 }}>🏆</button>

        {/* Turn timer bar */}
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${(timeLeft / 90) * 100}%`,
            background: timeLeft > 30 ? '#22c55e' : timeLeft > 10 ? '#eab308' : '#ef4444',
            transition: 'width 0.5s linear, background 0.5s',
          }} />
        </div>

        <button style={{ padding: '4px 12px', borderRadius: 8, background: '#16a34a', color: 'white', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          ↺ YENİ OYUN
        </button>
        <button style={{ padding: '4px 12px', borderRadius: 8, background: '#b91c1c', color: 'white', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚙ AYARLAR
        </button>
      </div>

      {/* ── MAIN GAME AREA ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', gap: 6, padding: '6px 8px', minHeight: 0, overflow: 'hidden' }}>

        {/* Left player */}
        <SidePlayer uid={leftUid} game={game} />

        {/* Center section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>

          {/* Top player */}
          <TopPlayer uid={topUid} game={game} />

          {/* Table + right controls */}
          <div style={{ flex: 1, display: 'flex', gap: 6, minHeight: 0 }}>

            {/* ── GREEN TABLE ──────────────────────────────────────── */}
            <div style={{
              flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative',
              background: '#267040',
              boxShadow: 'inset 0 0 30px rgba(0,0,0,0.35), 0 0 0 2px #1a5030',
            }}>
              {/* 2×2 quadrant grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: '100%', gap: 0 }}>
                {quadrantUids.map((uid, qi) => {
                  const p = game.players[uid];
                  const pile = game.discardPiles[uid] ?? [];
                  const recentDiscards = pile.slice(-8);
                  const isPickable = canDraw && uid !== myUid && recentDiscards.length > 0;
                  return (
                    <div key={uid} style={{
                      border: '1px solid rgba(255,255,255,0.1)',
                      position: 'relative', padding: 6, overflow: 'hidden',
                    }}>
                      {/* Player label */}
                      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600, marginBottom: 3, position: 'absolute', top: 4, left: 6 }}>
                        {p?.displayName ?? '—'}
                      </p>
                      {/* Discards */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, paddingTop: 16 }}>
                        {recentDiscards.map((tile, ti) => (
                          <motion.div key={tile.id}
                            whileHover={isPickable && ti === recentDiscards.length - 1 ? { y: -3, scale: 1.05 } : {}}
                            onClick={() => isPickable && ti === recentDiscards.length - 1 && onDrawFromDiscard(uid)}
                            style={{ cursor: isPickable && ti === recentDiscards.length - 1 ? 'pointer' : 'default' }}>
                            <TileComponent tile={tile} indicator={game.indicator} size="xs" />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Melds on table */}
              {game.melds.length > 0 && (
                <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, maxHeight: 70, overflow: 'auto' }}>
                  <MeldArea melds={game.melds} indicator={game.indicator} myUid={myUid}
                    canExtend={canDiscard && myPlayer?.hasOpened}
                    onExtendMeld={meldId => {
                      if (!selectedTileIds.size) { toast.error('Taş seç'); return; }
                      onExtendMeld(meldId, [...selectedTileIds]);
                      clearSelection();
                    }} />
                </div>
              )}

              {/* Turn indicator overlay */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
                <AnimatePresence mode="wait">
                  <motion.div key={game.currentTurnUid}
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                    <div style={{
                      padding: '4px 14px', borderRadius: 20,
                      background: isMyTurn ? 'rgba(250,204,21,0.9)' : 'rgba(0,0,0,0.6)',
                      color: isMyTurn ? '#000' : 'rgba(255,255,255,0.6)',
                      fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
                    }}>
                      {isMyTurn ? '🎯 Senin sıran!' : `⏳ ${game.players[game.currentTurnUid]?.displayName ?? '?'}`}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* ── RIGHT CONTROLS ────────────────────────────────── */}
            <div style={{ width: 90, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', flexShrink: 0 }}>

              {/* Indicator */}
              {game.indicator && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'rgba(250,204,21,0.6)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Gösterge</p>
                  <TileComponent tile={game.indicator.indicatorTile} size="sm" />
                </div>
              )}

              {/* Draw pile */}
              <div style={{ textAlign: 'center', position: 'relative' }}>
                <motion.button
                  disabled={!canDraw}
                  onClick={() => canDraw && onDrawFromPile()}
                  whileHover={canDraw ? { y: -3 } : {}}
                  whileTap={canDraw ? { scale: 0.95 } : {}}
                  style={{
                    width: 44, height: 60, borderRadius: 8, position: 'relative',
                    background: 'linear-gradient(160deg, #f0f0f0, #e8e8e8)',
                    border: `2px solid ${canDraw ? '#facc15' : '#aaa'}`,
                    boxShadow: canDraw ? '0 0 14px rgba(250,204,21,0.5), 0 3px 8px rgba(0,0,0,0.3)' : '0 3px 8px rgba(0,0,0,0.3)',
                    cursor: canDraw ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                  }}>
                  <span style={{ fontWeight: 900, color: '#374151', fontSize: 14 }}>{game.drawPileCount}</span>
                  <span style={{ fontSize: 8, color: '#6b7280' }}>kart</span>
                  {canDraw && (
                    <motion.div style={{ position: 'absolute', inset: -2, borderRadius: 9, border: '2px solid rgba(250,204,21,0.6)' }}
                      animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1 }} />
                  )}
                </motion.button>
              </div>

              {/* Right-side action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                <button
                  disabled
                  style={{ padding: '5px 4px', borderRadius: 6, background: '#1a3a2a', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, lineHeight: 1.2, textAlign: 'center', cursor: 'not-allowed' }}>
                  GERİ<br />TOPLA
                </button>
                <button
                  onClick={handleFivePairs}
                  disabled={!canDiscard || selectedTileIds.size !== 10}
                  style={{
                    padding: '5px 4px', borderRadius: 6, fontSize: 10, fontWeight: 700, lineHeight: 1.2, textAlign: 'center',
                    background: canDiscard && selectedTileIds.size === 10 ? '#6d28d9' : '#2a1a4a',
                    border: '1px solid rgba(109,40,217,0.3)', color: canDiscard && selectedTileIds.size === 10 ? 'white' : 'rgba(255,255,255,0.3)',
                    cursor: canDiscard && selectedTileIds.size === 10 ? 'pointer' : 'default',
                  }}>
                  ÇİFT<br />İŞLE
                </button>
                <button
                  onClick={handleOpenSelected}
                  disabled={!canDiscard || selectedTileIds.size < 3}
                  style={{
                    padding: '5px 4px', borderRadius: 6, fontSize: 10, fontWeight: 700, lineHeight: 1.2, textAlign: 'center',
                    background: canDiscard && selectedTileIds.size >= 3 ? '#1d4ed8' : '#0f1a3a',
                    border: '1px solid rgba(29,78,216,0.3)', color: canDiscard && selectedTileIds.size >= 3 ? 'white' : 'rgba(255,255,255,0.3)',
                    cursor: canDiscard && selectedTileIds.size >= 3 ? 'pointer' : 'default',
                  }}>
                  SERİ<br />İŞLE
                </button>

                {/* Discard columns for each player */}
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 2 }}>
                  {game.turnOrder.map(uid => {
                    const pile = game.discardPiles[uid] ?? [];
                    const top = pile[pile.length - 1];
                    const pickable = canDraw && uid !== myUid && !!top;
                    return (
                      <div key={uid} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 7, textAlign: 'center', maxWidth: 18, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {game.players[uid]?.displayName?.charAt(0)}
                        </p>
                        <motion.div whileHover={pickable ? { y: -2 } : {}}
                          onClick={() => pickable && onDrawFromDiscard(uid)}
                          style={{ cursor: pickable ? 'pointer' : 'default' }}>
                          {top
                            ? <TileComponent tile={top} indicator={game.indicator} size="xs" />
                            : <div style={{ width: 18, height: 26, borderRadius: 3, border: '1px dashed rgba(255,255,255,0.15)' }} />
                          }
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── MY PLAYER INFO ────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <motion.div
              animate={isMyTurn ? { scale: [1, 1.02, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 16px', borderRadius: 12,
                background: 'rgba(0,0,0,0.65)',
                border: `1px solid ${isMyTurn ? 'rgba(250,204,21,0.5)' : 'rgba(255,255,255,0.08)'}`,
                boxShadow: isMyTurn ? '0 0 12px rgba(250,204,21,0.2)' : undefined,
              }}>
              {/* Avatar with green ring */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  border: `2px solid ${isMyTurn ? '#facc15' : '#16a34a'}`,
                  background: 'linear-gradient(135deg, #374151, #1f2937)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 900, fontSize: 15,
                  boxShadow: '0 0 0 2px rgba(22,163,74,0.4)',
                }}>
                  {myPlayer?.displayName?.charAt(0).toUpperCase()}
                </div>
              </div>
              <div>
                <p style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{myPlayer?.displayName}</p>
                <p style={{ color: '#9ca3af', fontSize: 10 }}>
                  {myPlayer?.hasOpened ? '✓ Açtı' : '— — — —'} &nbsp; Beta Version: 1.0
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right player */}
        <SidePlayer uid={rightUid} game={game} />
      </div>

      {/* ── ACTION BUTTONS ROW ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '4px 12px', flexShrink: 0 }}>

        {/* Left: Çift buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={handleFivePairs}
            disabled={!canDiscard || selectedTileIds.size !== 10}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
              background: canDiscard && selectedTileIds.size === 10 ? '#6d28d9' : '#2a1a4a',
              border: '1px solid rgba(109,40,217,0.35)', color: 'white', fontWeight: 700, fontSize: 12,
              cursor: canDiscard && selectedTileIds.size === 10 ? 'pointer' : 'default',
              opacity: canDiscard && selectedTileIds.size !== 10 ? 0.45 : 1,
              boxShadow: canDiscard && selectedTileIds.size === 10 ? '0 2px 8px rgba(109,40,217,0.4)' : 'none',
            }}>
            <TileIcon nums={[6, 6]} colors={['#2563eb', '#2563eb']} />
            ÇİFT AÇ
          </button>
          <button
            onClick={handleCiftDiz}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
              background: '#1e3a5f', border: '1px solid rgba(59,130,246,0.25)', color: 'white', fontWeight: 700, fontSize: 12,
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer',
            }}>
            <TileIcon nums={[6, 6]} colors={['#2563eb', '#2563eb']} />
            ÇİFT DİZ
          </button>
        </div>

        {/* Center: discard / turn info */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {canDiscard && selectedTileIds.size === 1 && (
            <motion.button
              onClick={handleDiscardSelected}
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{
                padding: '6px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, color: 'white',
                background: '#dc2626', boxShadow: '0 0 14px rgba(220,38,38,0.5)',
              }}>
              🗑 TAŞ AT
            </motion.button>
          )}
          {canDiscard && selectedTileIds.size > 1 && previewType && (
            <div style={{ padding: '3px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.5)', color: '#fbbf24', fontSize: 11, fontWeight: 600 }}>
              {previewPoints}p ({previewType === 'group' ? 'grup' : 'seri'})
            </div>
          )}
          {canDraw && (
            <p style={{ color: 'rgba(250,204,21,0.5)', fontSize: 11 }}>Banka'dan veya atılan taştan çek</p>
          )}
          {myPlayer?.hasOpened && canDiscard && (
            <button
              onClick={() => {
                const tiles = tilesOrder.filter(t => selectedTileIds.has(t.id));
                if (!tiles.length || tiles.length < 3) { toast.error('En az 3 taş seç'); return; }
                const type = detectMeldType(tiles, game.indicator!);
                if (!type) { toast.error('Geçerli seri/grup değil'); return; }
                onDeclareFinish([{ id: `${myUid}-fin-${Date.now()}`, type, tiles, ownerId: myUid }]);
                clearSelection();
              }}
              style={{
                padding: '5px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, color: 'white',
                background: 'linear-gradient(90deg, #d97706, #b45309)', boxShadow: '0 2px 10px rgba(217,119,6,0.4)',
              }}>
              🏆 Bitir!
            </button>
          )}
        </div>

        {/* Right: Seri buttons + score */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              onClick={handleOpenSelected}
              disabled={!canDiscard || selectedTileIds.size < 3}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
                background: canDiscard && selectedTileIds.size >= 3 ? '#1d4ed8' : '#0f1a3a',
                border: '1px solid rgba(29,78,216,0.35)', color: 'white', fontWeight: 700, fontSize: 12,
                cursor: canDiscard && selectedTileIds.size >= 3 ? 'pointer' : 'default',
                opacity: !canDiscard || selectedTileIds.size < 3 ? 0.45 : 1,
                boxShadow: canDiscard && selectedTileIds.size >= 3 ? '0 2px 8px rgba(29,78,216,0.4)' : 'none',
              }}>
              <TileIcon nums={[1, 2, 3]} colors={['#dc2626', '#dc2626', '#dc2626']} />
              SERİ AÇ
            </button>
            <button
              onClick={handleSeriDiz}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
                background: '#166534', border: '1px solid rgba(34,197,94,0.25)', color: 'white', fontWeight: 700, fontSize: 12,
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer',
              }}>
              <TileIcon nums={[1, 2, 3]} colors={['#dc2626', '#dc2626', '#dc2626']} />
              SERİ DİZ
            </button>
          </div>

          {/* Live score badge */}
          <div style={{
            width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: livePoints >= MIN_OPEN_POINTS ? '#16a34a' : '#1d4ed8',
            color: 'white', fontWeight: 900, fontSize: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            {livePoints}
          </div>
        </div>
      </div>

      {/* ── WOODEN TILE RACK ────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: 'linear-gradient(180deg, #b07840 0%, #8b5e30 15%, #5d3a18 70%, #3a2010 100%)',
        borderTop: '3px solid #c49a6c',
        boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.5)',
        padding: '10px 16px 12px',
      }}>
        {/* Wood grain top strip */}
        <div style={{ height: 2, marginBottom: 8, borderRadius: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />

        <PlayerHand
          tiles={tilesOrder}
          indicator={game.indicator}
          selectedIds={selectedTileIds}
          onToggleSelect={toggleTileSelection}
          onReorder={setTilesOrder}
          isMyTurn={isMyTurn}
          meldGroupByTileId={meldGroupByTileId}
        />
      </div>
    </div>
  );
}
