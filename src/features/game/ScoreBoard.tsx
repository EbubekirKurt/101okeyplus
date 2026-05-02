import { motion } from 'framer-motion';
import React from 'react';
import { GameState } from '../../types/game';

interface ScoreBoardProps {
  game: GameState;
  onClose: () => void;
}

export function ScoreBoard({ game, onClose }: ScoreBoardProps) {
  const players = Object.values(game.players).sort((a, b) => a.seat - b.seat);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-emerald-900 border border-amber-700/50 rounded-2xl p-6 shadow-2xl min-w-72"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-amber-300 font-bold text-xl">Skor Tablosu</h2>
        <button onClick={onClose} className="text-emerald-400 hover:text-white transition-colors text-xl">×</button>
      </div>
      <p className="text-emerald-400 text-base mb-4">Tur: {game.roundNumber}</p>

      <div className="space-y-2">
        {players.sort((a, b) => a.totalScore - b.totalScore).map((player) => (
          <div
            key={player.uid}
            className={`flex items-center justify-between p-3 rounded-xl ${
              player.eliminated
                ? 'bg-red-900/30 border border-red-700/40 opacity-60'
                : 'bg-black/20 border border-emerald-700/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                player.eliminated ? 'bg-red-700' : 'bg-emerald-700'
              }`}>
                {player.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-medium text-base">{player.displayName}</p>
                {player.eliminated && (
                  <p className="text-red-400 text-sm">Elendi</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className={`font-bold text-lg ${
                player.totalScore >= 80 ? 'text-red-400' :
                player.totalScore >= 60 ? 'text-yellow-400' : 'text-green-300'
              }`}>
                {player.totalScore}
              </p>
              <p className="text-emerald-500 text-sm">/ 101</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-emerald-600 text-xs text-center mt-4">
        101 puana ulaşan oyuncu elenir
      </p>
    </motion.div>
  );
}
