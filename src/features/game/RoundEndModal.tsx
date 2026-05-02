import { motion } from 'framer-motion';
import React from 'react';
import { GameState } from '../../types/game';

interface RoundEndModalProps {
  game: GameState;
  myUid: string;
  onNextRound: () => void;
}

export function RoundEndModal({ game, myUid, onNextRound }: RoundEndModalProps) {
  const winner = game.winnerId ? game.players[game.winnerId] : null;
  const isHost = game.players[myUid]?.isHost;
  const myScore = game.players[myUid]?.roundScore || 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-emerald-900 border-2 border-amber-600 rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4"
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{winner?.uid === myUid ? '🏆' : '😅'}</div>
          <h2 className="text-amber-300 font-bold text-2xl mb-1">Tur Bitti!</h2>
          {winner && (
            <p className="text-white text-lg">
              <span className="text-amber-400 font-bold">{winner.displayName}</span> kazandı!
            </p>
          )}
        </div>

        <div className="space-y-2 mb-6">
          {Object.values(game.players)
            .sort((a, b) => a.roundScore - b.roundScore)
            .map((player) => (
              <div
                key={player.uid}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  player.uid === game.winnerId ? 'bg-amber-700/40 border border-amber-500/50' : 'bg-black/20'
                }`}
              >
                <span className="text-white font-medium">
                  {player.uid === game.winnerId && '🥇 '}
                  {player.displayName}
                </span>
                <div className="text-right">
                  <span className={`font-bold ${player.roundScore === 0 ? 'text-green-400' : 'text-white'}`}>
                    +{player.roundScore}
                  </span>
                  <span className="text-emerald-400 text-base ml-2">= {player.totalScore}</span>
                </div>
              </div>
            ))}
        </div>

        {isHost ? (
          <button
            onClick={onNextRound}
            className="w-full py-3.5 text-lg bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-colors"
          >
            Sonraki Tura Geç
          </button>
        ) : (
          <p className="text-center text-emerald-400 text-base">Host'un sonraki turu başlatması bekleniyor...</p>
        )}
      </motion.div>
    </div>
  );
}
