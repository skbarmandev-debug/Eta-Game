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
import LoginScreen from "./components/LoginScreen";
import { AvatarConfig } from "./types";
import { auth, db } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem("eta_online_name") || "Recruit";
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

  // Sign out helper
  const handleSignOut = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setUserData(null);
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  // Synchronize lobby invites directly from URL parameters ?room=XYZ
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get("room");
    if (urlRoom) {
      setRoomId(urlRoom.toUpperCase().replace(/[^A-Z0-9_-]/g, ""));
    }
  }, []);

  // Firebase auth state tracking
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setAuthLoading(true);
        const userDocRef = doc(db, "users", currentUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            if (data.displayName) {
              setPlayerName(data.displayName);
            }
          } else {
            // Setup brand new file document in database
            const cleanName = currentUser.displayName || `Recruit_${Math.floor(Math.random() * 899) + 100}`;
            const initialData = {
              uid: currentUser.uid,
              displayName: cleanName,
              email: currentUser.email || "",
              photoURL: currentUser.photoURL || "",
              wins: 0,
              kills: 0,
              deaths: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await setDoc(userDocRef, initialData);
            setUserData(initialData);
            setPlayerName(cleanName);
          }
        } catch (error) {
          console.error("Error fetching/setting userData:", error);
        } finally {
          setAuthLoading(false);
        }
      } else {
        setUserData(null);
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Persist edits inside local storage and Firestore database buffers
  const persistName = async (name: string) => {
    setPlayerName(name);
    localStorage.setItem("eta_online_name", name);
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      try {
        await setDoc(userDocRef, { displayName: name, updatedAt: new Date().toISOString() }, { merge: true });
        setUserData((prev: any) => prev ? { ...prev, displayName: name } : null);
      } catch (err) {
        console.error("Could not sync displayName to Firestore:", err);
      }
    }
  };

  const persistAvatar = (av: AvatarConfig) => {
    setAvatar(av);
    localStorage.setItem("eta_online_avatar", JSON.stringify(av));
  };

  const handleJoinArena = () => {
    setInGame(true);
  };

  const handleLeaveArena = async () => {
    setInGame(false);
    // Clear the URL room parameter to allow creating fresh rooms if they want
    window.history.pushState({}, "", window.location.pathname);
    // Generate a fresh random room ID for their next match if they want
    setRoomId(Math.random().toString(36).substring(2, 8).toUpperCase());

    // Refresh user profile database copy upon game ending to gather any kills/deaths stats
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          setUserData(snap.data());
        }
      } catch (err) {
        console.error("Could not refresh state database copy:", err);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#050505] items-center justify-center font-sans">
        <div className="w-10 h-10 border-4 border-[#22c55e] border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs text-slate-500 font-mono tracking-widest uppercase">
          Synthesizing Auth Credentials...
        </span>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={(u) => setUser(u)} />;
  }

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
          userData={userData}
          onSignOut={handleSignOut}
        />
      )}
    </main>
  );
}

