/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import LobbyScreen from "./components/LobbyScreen";
import CanvasGame from "./components/CanvasGame";
import { AvatarConfig } from "./types";

export default function App() {
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem("eta_online_name") || `Recruit_${Math.floor(Math.random() * 899) + 100}`;
  });

  const [avatar, setAvatar] = useState<AvatarConfig>(() => {
    try {
      const stored = localStorage.getItem("eta_online_avatar");
      if (stored) return JSON.parse(stored);
    } catch {}
    
    // Default avatar colors and gear
    const headAccessories: Array<"classic" | "helmet" | "visor" | "beret" | "crown"> = [
      "classic", "helmet", "visor", "beret", "crown"
    ];
    return {
      headStyle: headAccessories[Math.floor(Math.random() * headAccessories.length)],
      primaryColor: "#3b82f6", // default royal blue suit
      accentColor: "#fb7185"  // default pink gear highlight
    };
  });

  const [roomId, setRoomId] = useState<string>(() => {
    // Generate a secure random lobby code for standard matchmakers
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  });

  const [inGame, setInGame] = useState(false);

  // Synchronize lobby invites directly from URL parameters ?room=XYZ
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get("room");
    if (urlRoom) {
      setRoomId(urlRoom.toUpperCase().replace(/[^A-Z0-9_-]/g, ""));
      // Give them a chance to customize profile first, but set the room correctly!
    }
  }, []);

  // Persist edits inside local storage buffers
  const persistName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem("eta_online_name", name);
  };

  const persistAvatar = (av: AvatarConfig) => {
    setAvatar(av);
    localStorage.setItem("eta_online_avatar", JSON.stringify(av));
  };

  const handleJoinArena = () => {
    setInGame(true);
  };

  const handleLeaveArena = () => {
    setInGame(false);
    // Clear the URL room parameter to allow creating fresh rooms if they want
    window.history.pushState({}, "", window.location.pathname);
    // Generate a fresh random room ID for their next match if they want
    setRoomId(Math.random().toString(36).substring(2, 8).toUpperCase());
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden relative">
      {inGame ? (
        <CanvasGame
          roomId={roomId}
          playerName={playerName.trim()}
          avatar={avatar}
          onLeave={handleLeaveArena}
        />
      ) : (
        <LobbyScreen
          playerName={playerName}
          setPlayerName={persistName}
          avatar={avatar}
          setAvatar={persistAvatar}
          roomId={roomId}
          setRoomId={setRoomId}
          onJoin={handleJoinArena}
        />
      )}
    </main>
  );
}

