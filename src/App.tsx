import React, { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LandingPage } from './features/lobby/LandingPage';
import { RoomPage } from './features/room/RoomPage';
import { GamePage } from './features/game/GamePage';
import { signInAnon } from './services/firebase/auth';
import { useAuth } from './hooks/useAuth';

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      signInAnon().catch(console.error);
    }
  }, [user, loading]);

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthBootstrap>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#064e3b',
              color: '#d1fae5',
              border: '1px solid #065f46',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/room/:code" element={<RoomPage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
        </Routes>
      </AuthBootstrap>
    </BrowserRouter>
  );
}
