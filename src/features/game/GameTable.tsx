import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { detectMeldType, totalMeldPoints } from '../../lib/melds/validateMeld';
import { effectiveMinOpenPoints, effectiveMinOpenPairCount, getLeftOpponentUid } from '../../lib/engine/gameEngine';
import { peekNextDrawFromPile } from '../../lib/engine/deal';
import {
  seriDiz,
  ciftDiz,
  seriDizWithGaps,
  ciftDizWithGaps,
  tilesToGrid,
  gridToTiles,
} from '../../lib/auto-arrange';
import { normalizeRackGrid, scoreVisualRack, RACK_COLS } from '../../lib/rack/visualRackScore';
import { repairHandTileIds } from '../../lib/tiles/repairTileIds';
import { GameState, IndicatorInfo } from '../../types/game';
import { Meld } from '../../types/meld';
import { Tile } from '../../types/tile';
import { isOkey } from '../../lib/tiles/okey';
import { useUIStore } from '../../state/store';
import { MeldArea } from './MeldArea';
import { OpponentRack } from './OpponentRack';
import { PlayerHand } from './PlayerHand';
import { TileComponent } from '../tile/Tile';

// ── Mini tile icons for action buttons ────────────────────────────────────
function TileIcon({ nums, colors }: { nums: number[]; colors: string[] }) {
  return (
    <div className="flex gap-px flex-shrink-0">
      {nums.map((n, i) => (
        <div key={i} style={{
          width: 18, height: 26,
          background: 'linear-gradient(160deg, #fefce8, #fef3c7)',
          border: '1px solid #d0c090', borderRadius: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }}>
          <span style={{ color: colors[i] ?? colors[0], fontWeight: 900, fontSize: 10, lineHeight: 1 }}>{n}</span>
        </div>
      ))}
    </div>
  );
}

// ── Side player (left / right) ────────────────────────────────────────────
function SidePlayer({ uid, game, side }: { uid: string | undefined; game: GameState; side: 'left' | 'right' }) {
  if (!uid) return <div style={{ width: 100, flexShrink: 0 }} />;
  const p = game.players[uid];
  if (!p) return <div style={{ width: 100, flexShrink: 0 }} />;
  const isActive = game.currentTurnUid === uid;

  return (
    <div style={{
      width: 100, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '4px 2px', minHeight: 0,
    }}>
      {/* Rotated rack — same HorizontalRack as top player */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <OpponentRack tileCount={p.handCount ?? 0} position={side} />
      </div>

      {/* Avatar */}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `2px solid ${isActive ? '#facc15' : '#4b5563'}`,
          background: 'linear-gradient(135deg, #374151, #1f2937)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 900, fontSize: 16,
          boxShadow: isActive ? '0 0 10px rgba(250,204,21,0.5)' : undefined,
        }}>
          {p.displayName.charAt(0).toUpperCase()}
          {!p.connected && (
            <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', borderRadius: '50%', width: 16, height: 16, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>🤖</span>
          )}
        </div>
      </div>

      {/* Name badge */}
      <div style={{
        background: 'rgba(0,0,0,0.65)',
        border: `1px solid ${isActive ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 8, padding: '3px 6px', textAlign: 'center', width: '100%',
      }}>
        <p style={{ color: 'white', fontSize: 12, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</p>
        <p style={{ color: '#9ca3af', fontSize: 11, margin: 0 }}>{p.totalScore}p{p.hasOpened ? ' ✓' : ''}</p>
      </div>
    </div>
  );
}

// ── Top player (across) ───────────────────────────────────────────────────
function TopPlayer({ uid, game }: { uid: string | undefined; game: GameState }) {
  if (!uid) return null;
  const p = game.players[uid];
  if (!p) return null;
  const isActive = game.currentTurnUid === uid;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginBottom: 2, flexShrink: 0 }}>
      {/* Rack viewed from behind */}
      <OpponentRack tileCount={p.handCount ?? 0} position="top" />

      {/* Player badge */}
      <motion.div
        animate={isActive ? { scale: [1, 1.02, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 10,
          background: 'rgba(0,0,0,0.65)',
          border: `1px solid ${isActive ? 'rgba(250,204,21,0.5)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: isActive ? '0 0 12px rgba(250,204,21,0.2)' : undefined,
        }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          border: `2px solid ${isActive ? '#facc15' : '#4b5563'}`,
          background: 'linear-gradient(135deg, #374151, #1f2937)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 900, fontSize: 15,
        }}>
          {p.displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>{p.displayName}</p>
          <p style={{ color: '#9ca3af', fontSize: 12 }}>{p.totalScore}p {p.hasOpened ? '✓' : '—'}</p>
        </div>
      </motion.div>
    </div>
  );
}

// ── Last discard at one table corner (only top of pile shown) ─────────────
function CornerLastDiscard({
  game, uid, indicator, corner, canPick, onPick, cornerLabel,
}: {
  game: GameState;
  uid: string;
  indicator: IndicatorInfo | null;
  corner: 'tl' | 'tr' | 'bl' | 'br';
  canPick: boolean;
  onPick: () => void;
  cornerLabel?: string;
}) {
  const pile = game.discardPiles[uid] ?? [];
  const tile = pile[pile.length - 1];
  const p = game.players[uid];
  const pos = corner === 'tl' ? { top: 8, left: 8 }
    : corner === 'tr' ? { top: 8, right: 8 }
      : corner === 'bl' ? { bottom: 8, left: 8 }
        : { bottom: 8, right: 8 };
  const alignRight = corner === 'tr' || corner === 'br';

  return (
    <div style={{ position: 'absolute', ...pos, zIndex: 3, maxWidth: 120 }}>
      <p style={{
        color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, marginBottom: 2,
        textAlign: alignRight ? 'right' : 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {p?.displayName ?? '—'}
      </p>
      {cornerLabel && (
        <p style={{
          color: 'rgba(250,204,21,0.45)', fontSize: 10, fontWeight: 600, marginBottom: 4,
          textAlign: alignRight ? 'right' : 'left',
        }}>
          {cornerLabel}
        </p>
      )}
      {tile ? (
        <div
          key={tile.id}
          onClick={() => canPick && onPick()}
          style={{
            cursor: canPick ? 'pointer' : 'default',
            display: 'flex',
            justifyContent: alignRight ? 'flex-end' : 'flex-start',
            opacity: 1,
          }}
        >
          <TileComponent tile={tile} indicator={indicator} size="md" />
        </div>
      ) : (
        <div style={{
          width: 42, height: 60, borderRadius: 8,
          border: '1px dashed rgba(255,255,255,0.28)',
          background: 'rgba(0,0,0,0.15)',
          marginLeft: alignRight ? 'auto' : 0,
        }} />
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────
interface GameTableProps {
  game: GameState;
  myUid: string;
  hand: Tile[];
  onDrawFromPile: () => void | Promise<void>;
  onDrawFromDiscard: (fromUid: string) => void;
  onReturnDiscardDrawPile: () => void | Promise<void>;
  onDiscard: (tileId: string) => void;
  onOpenMelds: (melds: Meld[]) => void | Promise<boolean>;
  onLayAdditionalMelds: (melds: Meld[]) => void | Promise<boolean>;
  onOpenFivePairs: (tiles: Tile[]) => void | Promise<boolean>;
  onExtendMeld: (meldId: string, tileIds: string[]) => void;
  onDeclareFinish: (melds: Meld[]) => void;
}

export function GameTable({
  game, myUid, hand,
  onDrawFromPile, onDrawFromDiscard, onReturnDiscardDrawPile, onDiscard,
  onOpenMelds, onLayAdditionalMelds, onOpenFivePairs, onExtendMeld, onDeclareFinish,
}: GameTableProps) {
  const { selectedTileIds, toggleTileSelection, clearSelection } = useUIStore();
  const [tilesOrder, setTilesOrder] = useState<Tile[]>(hand);
  const [timeLeft, setTimeLeft] = useState(90);
  const [gridOverride, setGridOverride] = useState<(Tile | null)[][] | null>(null);
  /** PlayerHand’ten gelen gerçek 2×15 grid (boşluklar dahil); el değişince sıfırlanır. */
  const [visualRackGrid, setVisualRackGrid] = useState<(Tile | null)[][] | null>(null);
  const drawPileBtnRef = useRef<HTMLButtonElement>(null);
  const rackBandRef = useRef<HTMLDivElement>(null);
  const [drawPileBusy, setDrawPileBusy] = useState(false);
  const [dizDropdownOpen, setDizDropdownOpen] = useState(false);
  const [drawFlight, setDrawFlight] = useState<null | {
    tile: Tile;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }>(null);
  const [suppressHandTileIds, setSuppressHandTileIds] = useState<Set<string>>(() => new Set());

  const isMyTurn = game.currentTurnUid === myUid;
  const myPlayer = game.players[myUid];
  const canDraw = isMyTurn && game.phase === 'awaiting_draw';
  const canDiscard = isMyTurn && game.phase === 'awaiting_discard';
  const myScore = myPlayer?.totalScore ?? 0;

  const others = game.turnOrder.filter(u => u !== myUid);
  const topUid = others[0];
  const leftUid = others[1];
  const rightUid = others[2];
  const leftTakeUid = getLeftOpponentUid(game.turnOrder, myUid);
  const mustOpenFromLeft = game.mustOpenFromDiscard?.pickerUid === myUid;
  const minOpenPts = effectiveMinOpenPoints(game);
  const minOpenPairs = effectiveMinOpenPairCount(game);
  const pairTilesNeeded = minOpenPairs * 2;

  useEffect(() => {
    const source = repairHandTileIds(hand);
    setTilesOrder(prev => {
      const handIds = new Set(source.map(t => t.id));
      const handById = new Map(source.map(t => [t.id, t]));
      const kept = prev
        .filter(t => handIds.has(t.id))
        .map(t => handById.get(t.id)!);
      const keptIds = new Set(kept.map(t => t.id));
      const added = source.filter(t => !keptIds.has(t.id));
      const next = [...kept, ...added];
      if (
        prev.length === next.length
        && prev.every((t, i) => t.id === next[i]?.id)
      ) {
        return prev;
      }
      return next;
    });
    // El değiştiğinde animasyon gizlemesini temizle (yeni taş suppress'te kalmasın)
    resetDrawState();
  }, [hand]);

  const handIdSig = useMemo(() => [...hand].map(t => t.id).sort().join(','), [hand]);
  useEffect(() => {
    setVisualRackGrid(null);
  }, [handIdSig]);

  const handleRackGridSync = useCallback((g: (Tile | null)[][]) => {
    setVisualRackGrid(normalizeRackGrid(g));
  }, []);

  useEffect(() => {
    if (!game.turnDeadline) return;
    const iv = setInterval(() => setTimeLeft(Math.max(0, Math.ceil((game.turnDeadline! - Date.now()) / 1000))), 500);
    return () => clearInterval(iv);
  }, [game.turnDeadline]);

  function handleRackTileTap(tileId: string) {
    const t = tilesOrder.find(x => x.id === tileId);
    if (t && game.indicator && isOkey(t, game.indicator)) return;
    toggleTileSelection(tileId);
  }

  function handleDiscardSelected() {
    if (selectedTileIds.size !== 1) { toast.error('Atmak için 1 taş seç'); return; }
    const [id] = selectedTileIds;
    clearSelection();
    void onDiscard(id);
  }

  const myDiscardPile = game.discardPiles[myUid] || [];
  const lastOwnDiscard = myDiscardPile.length ? myDiscardPile[myDiscardPile.length - 1] : null;
  const leftPile = leftUid ? (game.discardPiles[leftUid] ?? []) : [];
  const lastLeftDiscard = leftPile.length ? leftPile[leftPile.length - 1]! : null;
  const openMo = game.mustOpenFromDiscard;
  const pickedFromLeftForSlot = openMo && openMo.pickerUid === myUid && leftUid && openMo.fromUid === leftUid
    ? tilesOrder.find(t => t.id === openMo.tileId) ?? null
    : null;
  const canReturnLeftPickSlot = Boolean(mustOpenFromLeft && canDiscard && openMo && tilesOrder.some(t => t.id === openMo.tileId));

  function handleSeriDiz() {
    if (!game.indicator) return;
    const withGaps = seriDizWithGaps(tilesOrder, game.indicator);
    const grid = tilesToGrid(withGaps, 15);
    setTilesOrder(gridToTiles(grid));
    setGridOverride(grid);
    setTimeout(() => setGridOverride(null), 100);
  }

  function handleCiftDiz() {
    if (!game.indicator) return;
    const withGaps = ciftDizWithGaps(tilesOrder, game.indicator);
    const grid = tilesToGrid(withGaps, 15);
    setTilesOrder(gridToTiles(grid));
    setGridOverride(grid);
    setTimeout(() => setGridOverride(null), 100);
  }

  // Live detection
  const selectedTiles = tilesOrder.filter(t => selectedTileIds.has(t.id));
  const previewType = selectedTiles.length >= 3 && game.indicator ? detectMeldType(selectedTiles, game.indicator) : null;
  const previewPoints = previewType && game.indicator ? totalMeldPoints([{ tiles: selectedTiles }], game.indicator) : 0;
  const myMeldPoints = game.melds.filter(m => m.ownerId === myUid).reduce((s, m) => s + (game.indicator ? totalMeldPoints([m], game.indicator) : 0), 0);
  const indicatorStableKey = game.indicator
    ? `${game.indicator.okeyColor}-${game.indicator.okeyNumber}-${game.indicator.indicatorTile.id}`
    : '';

  /** Istakada görünen boşluklar dahil grid; sync gelene kadar dolu sıra (satır satır paket). */
  const effectiveRackGrid = useMemo(
    () => visualRackGrid ?? tilesToGrid([...tilesOrder], RACK_COLS),
    [visualRackGrid, tilesOrder],
  );

  /** Seriler / vurgular: yalnızca ıstakada bitişik (boşluksuz) dizili geçerli perler. */
  const rackStats = useMemo(() => {
    const ind = game.indicator;
    if (!ind || !indicatorStableKey) return null;
    return scoreVisualRack(effectiveRackGrid, ind);
  }, [effectiveRackGrid, game.indicator, indicatorStableKey]);

  const livePoints = rackStats?.seriesPoints ?? 0;
  const livePairCount = rackStats?.pairSegmentCount ?? 0;

  const meldGroupByTileId = useMemo(
    () => rackStats?.meldGroupByTileId ?? new Map<string, number>(),
    [rackStats],
  );

  /** EL AÇ (ilk) veya açtıktan sonra yeni per ekle — ekrandaki bitişik per blokları. */
  async function handleOpenSelected() {
    const ind = game.indicator;
    if (!ind) return;

    let mf = rackStats?.meldsForOpen ?? [];
    // Aynı taşın birden fazla perde girmesini engelle
    const usedTileIds = new Set<string>();
    mf = mf.filter(m => {
      const ids = m.tiles.map(t => t.id);
      if (ids.some(id => usedTileIds.has(id))) return false;
      ids.forEach(id => usedTileIds.add(id));
      return true;
    });
    if (mf.length === 0) {
      toast.error(
        myPlayer?.hasOpened
          ? 'Istakada yeni per tespit edilmedi. SERİ DİZ ile grupla veya per oluştur.'
          : `Istakada bitişik per yok. SERİ DİZ ile düzenle veya açmak için toplam min ${minOpenPts} puanı ıstakada grupla.`,
      );
      return;
    }

    const ts = Date.now();
    const melds: Meld[] = mf.map((m, i) => ({
      id: `${myUid}-open-${ts}-${i}`,
      type: m.type,
      tiles: m.tiles,
      ownerId: myUid,
    }));

    if (myPlayer?.hasOpened) {
      const ok = await Promise.resolve(onLayAdditionalMelds(melds));
      if (ok !== false) clearSelection();
      return;
    }

    if (livePoints < minOpenPts) {
      toast.error(`Açmak için ıstakadaki bitişik perlerin toplamı en az ${minOpenPts} olmalı (şu an: ${livePoints}). SERİ DİZ deneyebilirsin.`);
      return;
    }

    const ok = await Promise.resolve(onOpenMelds(melds));
    if (ok !== false) clearSelection();
  }

  const canLayNewMelds = Boolean(myPlayer?.hasOpened && rackStats && rackStats.meldsForOpen.length > 0);
  const canFirstOpenSeri = Boolean(
    !myPlayer?.hasOpened && rackStats && rackStats.meldsForOpen.length > 0 && livePoints >= minOpenPts,
  );
  const seriButtonActive = Boolean(canDiscard && (canFirstOpenSeri || canLayNewMelds));

  async function handleFivePairs() {
    const tiles = tilesOrder.filter(t => selectedTileIds.has(t.id));
    if (tiles.length !== pairTilesNeeded) {
      toast.error(`${minOpenPairs} çift için tam ${pairTilesNeeded} taş seç.`);
      return;
    }
    const ok = await Promise.resolve(onOpenFivePairs(tiles));
    if (ok !== false) clearSelection();
  }

  async function handleDrawPilePress() {
    if (!canDraw) return;
    if (drawPileBusy) {
      resetDrawState();
      return;
    }
    const next = peekNextDrawFromPile(game);
    if (!next) {
      toast.error('Bankada taş yok');
      return;
    }
    setDrawPileBusy(true);
    const pileEl = drawPileBtnRef.current;
    const rackEl = rackBandRef.current;
    const TW = 52;
    const TH = 74;
    if (pileEl && rackEl) {
      const pr = pileEl.getBoundingClientRect();
      const rr = rackEl.getBoundingClientRect();
      setDrawFlight({
        tile: next,
        fromX: pr.left + pr.width / 2 - TW / 2,
        fromY: pr.top + pr.height / 2 - TH / 2,
        toX: rr.right - TW - 20,
        toY: rr.top + Math.min(rr.height * 0.55, 80) - TH / 2,
      });
      setSuppressHandTileIds(new Set([next.id]));
    }
    try {
      await onDrawFromPile();
    } catch {
      toast.error('Bankadan çekilemedi');
      resetDrawState();
      return;
    }
    setTimeout(resetDrawState, 800);
  }

  function resetDrawState() {
    setDrawPileBusy(false);
    setDrawFlight(null);
    setSuppressHandTileIds(new Set());
  }

  useEffect(() => {
    resetDrawState();
  }, [game.currentTurnUid, game.phase]);

  function onDrawFlightComplete() {
    resetDrawState();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#1a5c32', overflow: 'hidden' }}>

      {/* ── TOP BAR (masa içi) ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', minHeight: 54,
        background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <button type="button" style={{ color: '#facc15', fontSize: 26, lineHeight: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(250,204,21,0.25)', background: 'rgba(0,0,0,0.25)' }} title="Skor">
          🏆
        </button>

        <div style={{ flex: 1, height: 12, borderRadius: 6, background: 'rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 6,
            width: `${(timeLeft / 90) * 100}%`,
            background: timeLeft > 30 ? '#22c55e' : timeLeft > 10 ? '#eab308' : '#ef4444',
            transition: 'width 0.5s linear, background 0.5s',
          }} />
        </div>

        <button type="button" style={{ padding: '10px 16px', borderRadius: 10, background: '#16a34a', color: 'white', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer' }}>
          ↺ YENİ OYUN
        </button>
        <button type="button" style={{ padding: '10px 16px', borderRadius: 10, background: '#b91c1c', color: 'white', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer' }}>
          ⚙ AYARLAR
        </button>
      </div>

      {/* ── MAIN GAME AREA ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px', minHeight: 0, overflow: 'hidden' }}>

        {/* Top player */}
        <TopPlayer uid={topUid} game={game} />

        {/* Middle row: left side | green table | right side */}
        <div style={{ flex: 1, display: 'flex', gap: 6, minHeight: 0 }}>

          {/* Left side player */}
          <SidePlayer uid={leftUid} game={game} side="left" />

          {/* ── GREEN TABLE ──────────────────────────────────────── */}
          <div style={{
            flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative',
            background: '#267040',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.35), 0 0 0 2px #1a5030',
          }}>
            {/* Sağ üst köşe: Seriler/Çiftler + Gösterge/Havuz */}
            <div style={{
              position: 'absolute', top: 10, right: 10, zIndex: 20,
              display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
            }}>
              {/* Gösterge + Havuz yan yana */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {game.indicator && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <p style={{ color: 'rgba(250,204,21,0.75)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Gösterge</p>
                    <TileComponent tile={game.indicator.indicatorTile} size="md" />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <p style={{ color: 'rgba(156,163,175,0.75)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Havuz</p>
                  <motion.button
                    ref={drawPileBtnRef}
                    disabled={!canDraw || drawPileBusy}
                    onClick={() => void handleDrawPilePress()}
                    whileHover={canDraw && !drawPileBusy ? { y: -3 } : {}}
                    whileTap={canDraw && !drawPileBusy ? { scale: 0.95 } : {}}
                    style={{
                      width: 52, height: 70, borderRadius: 8, position: 'relative',
                      background: 'linear-gradient(160deg, #f0f0f0, #e8e8e8)',
                      border: `2px solid ${canDraw && !drawPileBusy ? '#facc15' : '#aaa'}`,
                      boxShadow: canDraw && !drawPileBusy ? '0 0 14px rgba(250,204,21,0.5), 0 3px 8px rgba(0,0,0,0.3)' : '0 3px 8px rgba(0,0,0,0.3)',
                      cursor: canDraw && !drawPileBusy ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                      opacity: drawPileBusy ? 0.75 : 1,
                    }}>
                    <span style={{ fontWeight: 900, color: '#374151', fontSize: 17 }}>{game.drawPileCount}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>kart</span>
                    {canDraw && !drawPileBusy && (
                      <motion.div style={{ position: 'absolute', inset: -2, borderRadius: 9, border: '2px solid rgba(250,204,21,0.6)' }}
                        animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1 }} />
                    )}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Son atılan taş köşeleri */}
            {topUid && (
              <CornerLastDiscard
                game={game} uid={topUid} indicator={game.indicator} corner="tl"
                canPick={false} onPick={() => {}} cornerLabel="Üst"
              />
            )}
            {rightUid && (
              <CornerLastDiscard
                game={game} uid={rightUid} indicator={game.indicator} corner="bl"
                canPick={false} onPick={() => {}} cornerLabel="Sağ"
              />
            )}

            {/* Melds on table */}
            {game.melds.length > 0 && (
              <div style={{
                position: 'absolute', left: 4, right: 4, top: 6, bottom: 8, zIndex: 12,
                overflow: 'visible', display: 'flex', alignItems: 'flex-start',
                alignContent: 'flex-start', paddingTop: 2, paddingBottom: 2, pointerEvents: 'none',
              }}>
                <MeldArea
                  melds={game.melds}
                  indicator={game.indicator}
                  myUid={myUid}
                  players={game.players}
                  canExtend={canDiscard && myPlayer?.hasOpened}
                  onExtendMeld={meldId => {
                    if (!selectedTileIds.size) { toast.error('Taş seç'); return; }
                    onExtendMeld(meldId, [...selectedTileIds]);
                    clearSelection();
                  }}
                />
              </div>
            )}

            {/* Turn indicator */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 4 }}>
              <AnimatePresence mode="wait">
                <motion.div key={game.currentTurnUid}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <div style={{
                    padding: '4px 14px', borderRadius: 20,
                    background: isMyTurn ? 'rgba(250,204,21,0.9)' : 'rgba(0,0,0,0.6)',
                    color: isMyTurn ? '#000' : 'rgba(255,255,255,0.6)',
                    fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap',
                  }}>
                    {isMyTurn ? '🎯 Senin sıran!' : `⏳ ${game.players[game.currentTurnUid]?.displayName ?? '?'}`}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Right side player */}
          <SidePlayer uid={rightUid} game={game} side="right" />
        </div>
      </div>

      {/* ── ACTION BUTTONS ROW ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px 3px', flexShrink: 0, gap: 8 }}>
        {canDiscard && selectedTileIds.size === 1 && (
          <motion.button
            type="button"
            onClick={handleDiscardSelected}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              padding: '8px 22px', borderRadius: 10, fontWeight: 700, fontSize: 15, color: 'white',
              background: '#dc2626', boxShadow: '0 0 14px rgba(220,38,38,0.5)', border: 'none', cursor: 'pointer',
            }}>
            🗑 TAŞ AT
          </motion.button>
        )}
        {canDiscard && selectedTileIds.size > 1 && previewType && (
          <div style={{ padding: '4px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.5)', color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>
            {previewPoints}p ({previewType === 'group' ? 'grup' : 'seri'})
          </div>
        )}
        {canDraw && (
          <p style={{ color: 'rgba(250,204,21,0.5)', fontSize: 13, margin: 0 }}>Bankadan çek veya soldaki son taşı al</p>
        )}
        {mustOpenFromLeft && canDiscard && (
          <p style={{ color: '#fb923c', fontSize: 13, fontWeight: 700, margin: 0, textAlign: 'center', maxWidth: 400 }}>
            Soldan taş aldın: per (≥{minOpenPts} puan) veya {minOpenPairs} çift ({pairTilesNeeded} taş), ya da «Geri Ver».
          </p>
        )}
        {myPlayer?.hasOpened && canDiscard && (
          <button
            type="button"
            onClick={() => {
              const tiles = tilesOrder.filter(t => selectedTileIds.has(t.id));
              if (!tiles.length || tiles.length < 3) { toast.error('En az 3 taş seç'); return; }
              const type = detectMeldType(tiles, game.indicator!);
              if (!type) { toast.error('Geçerli seri/grup değil'); return; }
              onDeclareFinish([{ id: `${myUid}-fin-${Date.now()}`, type, tiles, ownerId: myUid }]);
              clearSelection();
            }}
            style={{
              padding: '7px 16px', borderRadius: 8, fontWeight: 700, fontSize: 14, color: 'white',
              background: 'linear-gradient(90deg, #d97706, #b45309)', boxShadow: '0 2px 10px rgba(217,119,6,0.4)',
              border: 'none', cursor: 'pointer',
            }}>
            🏆 Bitir!
          </button>
        )}
        {!canDiscard && !canDraw && (
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, margin: 0 }}>
            ⏳ {game.players[game.currentTurnUid]?.displayName ?? '?'} oynuyor…
          </p>
        )}
      </div>

      {/* ── Kullanıcı bilgisi + aksiyon butonları ───────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, width: '100%', padding: '2px 8px 0' }}>

        {/* Left spacer — same flex basis as right buttons to keep name centred */}
        <div style={{ flex: 1 }} />

        {/* Center: player badge */}
        <motion.div
          animate={isMyTurn ? { scale: [1, 1.02, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '3px 12px', borderRadius: 12,
            background: 'rgba(0,0,0,0.65)',
            border: `1px solid ${isMyTurn ? 'rgba(250,204,21,0.5)' : 'rgba(255,255,255,0.08)'}`,
            boxShadow: isMyTurn ? '0 0 12px rgba(250,204,21,0.2)' : undefined,
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            border: `2px solid ${isMyTurn ? '#facc15' : '#16a34a'}`,
            background: 'linear-gradient(135deg, #374151, #1f2937)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 900, fontSize: 15,
            boxShadow: '0 0 0 2px rgba(22,163,74,0.4)',
          }}>
            {myPlayer?.displayName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ color: 'white', fontSize: 14, fontWeight: 600, margin: 0 }}>{myPlayer?.displayName}</p>
            <p style={{ color: '#9ca3af', fontSize: 11, margin: 0 }}>
              {myPlayer?.hasOpened ? '✓ Açtı' : '— — — —'}
            </p>
          </div>
        </motion.div>

        {/* Right: action buttons */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
          {/* ÇİFT AÇ */}
          <button
            type="button"
            onClick={() => void handleFivePairs()}
            disabled={!canDiscard || !!myPlayer?.hasOpened || selectedTileIds.size !== pairTilesNeeded}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8,
              background: canDiscard && !myPlayer?.hasOpened && selectedTileIds.size === pairTilesNeeded ? '#6d28d9' : '#2a1a4a',
              border: '1px solid rgba(109,40,217,0.35)', color: 'white', fontWeight: 700, fontSize: 13,
              cursor: canDiscard && !myPlayer?.hasOpened && selectedTileIds.size === pairTilesNeeded ? 'pointer' : 'default',
              opacity: canDiscard && !myPlayer?.hasOpened && selectedTileIds.size === pairTilesNeeded ? 1 : 0.5,
            }}>
            <TileIcon nums={[6, 6]} colors={['#2563eb', '#2563eb']} />
            ÇİFT AÇ
          </button>

          {/* SERİ AÇ / PER EKLE */}
          <button
            type="button"
            onClick={() => void handleOpenSelected()}
            disabled={!seriButtonActive}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8,
              background: seriButtonActive ? '#15803d' : '#0f1a3a',
              border: `1px solid ${seriButtonActive ? 'rgba(34,197,94,0.45)' : 'rgba(29,78,216,0.2)'}`,
              color: 'white', fontWeight: 700, fontSize: 13,
              cursor: seriButtonActive ? 'pointer' : 'default',
              opacity: seriButtonActive ? 1 : 0.5,
            }}>
            <TileIcon nums={[1, 2, 3]} colors={['#dc2626', '#dc2626', '#dc2626']} />
            {myPlayer?.hasOpened ? 'PER EKLE' : 'SERİ AÇ'}
          </button>

          {/* OTOMATİK DİZ dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setDizDropdownOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8,
                background: '#1e3a5f', border: '1px solid rgba(59,130,246,0.35)',
                color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
              <TileIcon nums={[1, 2, 3]} colors={['#dc2626', '#2563eb', '#16a34a']} />
              OTOMATİK DİZ <span style={{ fontSize: 10, marginLeft: 2 }}>{dizDropdownOpen ? '▼' : '▲'}</span>
            </button>
            {dizDropdownOpen && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 4px)', right: 0,
                background: '#1e2d3d', border: '1px solid rgba(59,130,246,0.35)',
                borderRadius: 8, overflow: 'hidden', zIndex: 50,
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                minWidth: 145,
              }}>
                <button
                  type="button"
                  onClick={() => { handleSeriDiz(); setDizDropdownOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                    padding: '8px 12px', background: 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.07)',
                    color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>
                  <TileIcon nums={[1, 2, 3]} colors={['#dc2626', '#dc2626', '#dc2626']} />
                  SERİ DİZ
                </button>
                <button
                  type="button"
                  onClick={() => { handleCiftDiz(); setDizDropdownOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                    padding: '8px 12px', background: 'transparent',
                    border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>
                  <TileIcon nums={[6, 6]} colors={['#2563eb', '#2563eb']} />
                  ÇİFT DİZ
                </button>
              </div>
            )}
          </div>

          {/* Live score badge */}
          <div style={{
            width: 46, height: 46, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: myPlayer?.hasOpened
              ? (canLayNewMelds ? '#16a34a' : '#1d4ed8')
              : (livePoints >= minOpenPts ? '#16a34a' : '#1d4ed8'),
            color: 'white', fontWeight: 900, fontSize: 18,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            {livePoints}
          </div>
        </div>
      </div>

      {/* ── Seriler / Çiftler kartları — ıstakanın hemen üstü ─────────── */}
      <div style={{ display: 'flex', gap: 8, padding: '4px 10px 2px', flexShrink: 0 }}>
        {/* Seriler kartı */}
        <div style={{
          background: 'rgba(0,0,0,0.55)', border: `1px solid ${livePoints >= minOpenPts ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8, padding: '5px 12px',
        }}>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 }}>Seriler</p>
          <p style={{ margin: 0, lineHeight: 1.2 }}>
            <span style={{ color: livePoints >= minOpenPts ? '#4ade80' : 'white', fontSize: 16, fontWeight: 900 }}>{livePoints}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}> / {minOpenPts}</span>
          </p>
        </div>
        {/* Çiftler kartı */}
        <div style={{
          background: 'rgba(0,0,0,0.55)', border: `1px solid ${livePairCount >= minOpenPairs ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8, padding: '5px 12px',
        }}>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 }}>Çiftler</p>
          <p style={{ margin: 0, lineHeight: 1.2 }}>
            <span style={{ color: livePairCount >= minOpenPairs ? '#a78bfa' : 'white', fontSize: 16, fontWeight: 900 }}>{livePairCount}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}> / {minOpenPairs}</span>
          </p>
        </div>
      </div>

      {/* ── WOODEN TILE RACK ────────────────────────────────────────────── */}
      <div
        ref={rackBandRef}
        style={{
          flexShrink: 0,
          background: 'linear-gradient(180deg, #b07840 0%, #8b5e30 15%, #5d3a18 70%, #3a2010 100%)',
          borderTop: '3px solid #c49a6c',
          boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.5)',
          padding: '10px 10px 12px',
        }}
      >
        <PlayerHand
          tiles={tilesOrder}
          indicator={game.indicator}
          selectedIds={selectedTileIds}
          onTileTap={handleRackTileTap}
          onReorder={setTilesOrder}
          meldGroupByTileId={meldGroupByTileId}
          gridOverride={gridOverride}
          onRackGridSync={handleRackGridSync}
          hiddenTileIds={suppressHandTileIds}
          canDiscard={canDiscard}
          lastOwnDiscard={lastOwnDiscard}
          onDiscardToPile={(id: string) => { clearSelection(); void onDiscard(id); }}
          showLeftDiscardSlot={Boolean(leftUid)}
          leftNeighborName={leftUid ? game.players[leftUid]?.displayName : undefined}
          leftPileTopTile={lastLeftDiscard}
          canPickLeftDiscard={Boolean(canDraw && leftTakeUid === leftUid && leftPile.length > 0)}
          onPickLeftDiscard={leftUid ? () => { void onDrawFromDiscard(leftUid); } : undefined}
          mustRespondToLeftPick={Boolean(mustOpenFromLeft && canDiscard)}
          pickedFromLeftTile={pickedFromLeftForSlot}
          canReturnLeftPick={canReturnLeftPickSlot}
          onReturnLeftPick={() => { void onReturnDiscardDrawPile(); }}
        />
      </div>

      {drawFlight && typeof document !== 'undefined' && createPortal(
        <motion.div
          key={drawFlight.tile.id}
          className="pointer-events-none"
          style={{
            position: 'fixed',
            left: drawFlight.fromX,
            top: drawFlight.fromY,
            width: 52,
            height: 74,
            zIndex: 10000,
          }}
          initial={{ x: 0, y: 0, scale: 0.88, opacity: 1 }}
          animate={{
            x: drawFlight.toX - drawFlight.fromX,
            y: drawFlight.toY - drawFlight.fromY,
            scale: 1,
            opacity: 1,
          }}
          transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={onDrawFlightComplete}
        >
          <TileComponent tile={drawFlight.tile} indicator={game.indicator} size="md" />
        </motion.div>,
        document.body,
      )}
    </div>
  );
}
