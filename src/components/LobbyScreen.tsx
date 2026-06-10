/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Copy, Sparkles, Check, Play, User, Users, ShieldAlert, Swords, Keyboard, Server, Trophy } from "lucide-react";
import { AvatarConfig } from "../types";

interface LobbyScreenProps {
  playerName: string;
  setPlayerName: (n: string) => void;
  avatar: AvatarConfig;
  setAvatar: (a: AvatarConfig) => void;
  roomId: string;
  setRoomId: (r: string) => void;
  onJoin: () => void;
  userData?: any;
  onSignOut?: () => void;
}

const PRESET_COLORS = [
  "#22c55e", // Green
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#eab308", // Yellow
  "#a855f7", // Purple
  "#f97316", // Orange
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#64748b"  // Slate
];

const ACCENT_COLORS = [
  "#ffffff", // White
  "#1e293b", // Dark Slate
  "#ef4444", // Red
  "#fb7185", // Rose
  "#ffd700", // Gold
  "#f43f5e", // Crimson
  "#10b981", // Emerald
  "#a855f7", // Violet
];

const HEAD_ACCESSORIES = [
  { id: "classic" as const, label: "Classic Soldier" },
  { id: "helmet" as const, label: "Titan Helmet" },
  { id: "visor" as const, label: "Cyber Visor" },
  { id: "beret" as const, label: "Elite Beret" },
  { id: "crown" as const, label: "Royal Crown" }
];

export default function LobbyScreen({
  playerName,
  setPlayerName,
  avatar,
  setAvatar,
  roomId,
  setRoomId,
  onJoin,
  userData,
  onSignOut
}: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);

  const generateInviteLink = () => {
    const base = window.location.origin + window.location.pathname;
    const inviteUrl = `${base}?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRandomize = () => {
    const randHead = HEAD_ACCESSORIES[Math.floor(Math.random() * HEAD_ACCESSORIES.length)].id;
    const randPrimary = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
    const randAccent = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
    setAvatar({
      headStyle: randHead,
      primaryColor: randPrimary,
      accentColor: randAccent
    });
  };

  const handleRenewRoomId = () => {
    const nextRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(nextRoomId);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#050505] text-[#f8fafc] font-sans overflow-y-auto overflow-x-hidden p-6 relative">
      
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_80%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Header Container */}
      <header className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-[#1e293b] pb-6 mb-8 z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#22c55e]/10 rounded-xl border border-[#22c55e]/20 text-[#22c55e]">
            <Swords className="w-6 h-6 animate-pulse" />
          </div>
          <div className="text-2xl font-black tracking-tighter text-white">
            ETA <span className="text-[#22c55e]">ONLINE</span>
          </div>
        </div>

        {/* User Status Badge & google details */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 bg-[#121212] border border-[#1e293b] py-2 px-4 rounded-full shadow-lg relative">
            {userData?.photoURL ? (
              <img
                src={userData.photoURL}
                alt="Profile"
                className="w-5 h-5 rounded-full object-cover border border-[#1e293b]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-ping" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e] absolute" />
              </>
            )}
            <span className="font-semibold text-sm max-w-[120px] truncate text-slate-200">
              {playerName.trim() || "Recruit"}
            </span>
            <span className="bg-emerald-500/10 text-[#22c55e] text-[10px] px-2 py-0.5 rounded-full font-bold border border-[#22c55e]/20">
              Rank {Math.max(1, Math.floor((userData?.kills ?? 0) / 10) + 1)}
            </span>
          </div>

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="px-4 py-2 border border-red-500/20 hover:border-red-500/40 text-red-500/95 hover:bg-red-500/5 text-xs font-bold rounded-full transition-all active:scale-95 uppercase cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* Main Bento Grid layout */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-5 z-10 flex-grow auto-rows-max">

        {/* 1. Hero Card: READY FOR BATTLE? (Columns 1-8, Rows 1-5 equivalent) */}
        <div id="bento-hero" className="md:col-span-12 lg:col-span-8 bg-[#121212] bg-[radial-gradient(ellipse_at_bottom_right,rgba(34,197,94,0.12),transparent_65%)] border border-emerald-500/30 rounded-[20px] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(34,197,94,0.06)] group min-h-[360px]">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#22c55e]/15 border border-[#22c55e]/20 text-[#22c55e] text-xs font-bold uppercase tracking-widest">
              LOBBY ID: #{roomId || "N/A"}
            </div>
            
            {/* CallSign quick edit integrated inside Bento Hero */}
            <div className="flex flex-col gap-1 text-left sm:text-right w-full sm:max-w-[200px]">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Warlord Callsign</label>
              <input
                type="text"
                maxLength={15}
                placeholder="Callsign..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full bg-[#050505] border border-slate-800 focus:border-[#22c55e] rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none transition-all placeholder:text-slate-700"
              />
            </div>
          </div>

          <div className="my-6 z-10">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-3 leading-none uppercase">
              Ready for <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-[#22c55e]">Battle?</span>
            </h1>
            <p className="text-slate-400 text-sm max-w-lg leading-relaxed">
              Tactical match hosted on US-EAST Sandbox. Grab rocket jetpack boots, arm your rifles and grenades, and dive into high-adrenaline 2D combat action.
            </p>
          </div>

          <div className="z-10 pt-2 flex flex-col sm:flex-row gap-4 items-center">
            <button
              onClick={onJoin}
              className="w-full sm:w-auto px-10 py-4 bg-[#22c55e] hover:bg-emerald-400 active:bg-emerald-600 text-black font-extrabold text-base rounded-xl transition-all duration-250 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 uppercase shadow-lg shadow-emerald-500/20 tracking-wider"
            >
              <Play className="w-5 h-5 fill-black text-black" />
              Launch Game
            </button>
            <p className="text-slate-500 text-xs text-center sm:text-left">
              All combat engines loaded and configured. Ready to deploy.
            </p>
          </div>

          {/* Absolute Background Combat watermark */}
          <div className="absolute bottom-[-15px] right-[-15px] text-8xl sm:text-9xl font-black text-emerald-500/3 tracking-widest select-none pointer-events-none select-none uppercase font-display group-hover:scale-105 transition-transform duration-700">
            COMBAT
          </div>
        </div>

        {/* 2. Invite Card (Columns 9-12, Rows 1-3 equivalent) */}
        <div id="bento-invite" className="md:col-span-6 lg:col-span-4 bg-[#121212] border border-[#1e293b] rounded-[20px] p-6 flex flex-col justify-between transition-all duration-300 hover:border-slate-700">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
              Invite Friends & Squad
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-normal">
              Copy this tactical join URL and send it to your wingmen to drop instantly in.
            </p>

            {/* Custom Invite Link Container resembling the bento box outline */}
            <div className="bg-[#050505] border border-dashed border-[#1e293b] p-3 rounded-lg flex justify-between items-center my-3 group">
              <span className="font-mono text-xs text-[#22c55e] truncate select-all">
                {roomId ? `${window.location.host}/?room=${roomId}` : "etaonline.game/join"}
              </span>
              <button 
                onClick={generateInviteLink} 
                className="p-1 hover:bg-[#121212] rounded transition text-[#22c55e]"
                title="Copy Invite Link"
              >
                {copied ? <Check className="w-4.5 h-4.5 text-emerald-400" /> : <Copy className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            <div className="text-left w-full">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                Connected Room ID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                placeholder="ROOM-CODE"
                className="w-full bg-black border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono font-bold tracking-widest text-[#22c55e] uppercase focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e] outline-none transition-all"
              />
            </div>

            <button
              onClick={handleRenewRoomId}
              className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-black text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              Generate New Link
            </button>
          </div>
        </div>

        {/* 3. Warrior Customization & Loadout Card (Columns 1-4, Rows 6-8 equivalent) */}
        <div id="bento-loadout" className="md:col-span-12 lg:col-span-5 bg-[#121212] border border-[#1e293b] rounded-[20px] p-6 flex flex-col justify-between transition-all duration-300 hover:border-slate-700">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-900 mb-4">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Warrior Customize
              </div>
              <span className="text-[#22c55e] text-[11px] font-bold">Uzi + Grenades</span>
            </div>

            {/* Character Render Container */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center mb-5">
              <div className="bg-[#050505] p-3 rounded-xl border border-slate-800/60 flex items-center justify-center min-h-[110px] relative overflow-hidden">
                <span className="absolute top-1 left-2 text-[8px] uppercase tracking-wider font-bold text-slate-500">Preview</span>
                
                {/* Live Character Visual representation */}
                <div className="relative w-20 h-20 flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
                  <div className="absolute -bottom-1 w-8 h-4 flex gap-1 justify-center">
                    <div className="w-1.5 h-3 bg-orange-500 rounded-full animate-bounce" />
                    <div className="w-1.5 h-3.5 bg-yellow-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                  </div>
                  
                  <svg className="w-16 h-16" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="38" fill={avatar.primaryColor} stroke="#050505" strokeWidth="5" />
                    {/* Hand items */}
                    <circle cx="18" cy="65" r="11" fill={avatar.accentColor} stroke="#050505" strokeWidth="3" />
                    <circle cx="82" cy="65" r="11" fill={avatar.accentColor} stroke="#050505" strokeWidth="3" />
                    
                    {/* Headstyles */}
                    {avatar.headStyle === "classic" && (
                      <path d="M 20 40 Q 50 10 80 40 Z" fill={avatar.accentColor} stroke="#050505" strokeWidth="4" />
                    )}
                    {avatar.headStyle === "helmet" && (
                      <>
                        <circle cx="50" cy="45" r="30" fill={avatar.accentColor} stroke="#050505" strokeWidth="4" />
                        <path d="M 35 48 H 65 V 53 H 35 Z" fill="#1e293b" stroke="#050505" strokeWidth="2.5" />
                      </>
                    )}
                    {avatar.headStyle === "visor" && (
                      <>
                        <path d="M 23 35 H 77 V 50 H 23 Z" fill="#06b6d4" stroke="#050505" strokeWidth="3.5" />
                        <line x1="28" y1="42" x2="72" y2="42" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                      </>
                    )}
                    {avatar.headStyle === "beret" && (
                      <path d="M 18 42 C 16 22, 84 22, 82 42 Z" fill="#991b1b" stroke="#050505" strokeWidth="4" />
                    )}
                    {avatar.headStyle === "crown" && (
                      <path d="M 22 45 L 30 18 L 50 33 L 70 18 L 78 45 Z" fill="#ffd700" stroke="#050505" strokeWidth="3" />
                    )}
                    
                    {/* Eyes */}
                    <g>
                      <circle cx="42" cy="55" r="5" fill="#000" />
                      <circle cx="58" cy="55" r="5" fill="#000" />
                    </g>
                  </svg>
                </div>
              </div>

              {/* Helmet selector */}
              <div className="col-span-2 flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outfit Headgear</label>
                <div className="flex flex-wrap gap-1">
                  {HEAD_ACCESSORIES.map((head) => (
                    <button
                      key={head.id}
                      onClick={() => setAvatar({ ...avatar, headStyle: head.id })}
                      className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                        avatar.headStyle === head.id
                          ? "bg-[#22c55e] border-[#22c55e] text-black"
                          : "bg-[#050505] border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"
                      }`}
                    >
                      {head.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Color circles */}
            <div className="space-y-4">
              {/* Suit Color */}
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Suit Armor</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col}
                      onClick={() => setAvatar({ ...avatar, primaryColor: col })}
                      style={{ backgroundColor: col }}
                      className="w-6 h-6 rounded-full border-2 border-[#050505] hover:scale-110 active:scale-90 transition-all flex items-center justify-center relative shadow"
                    >
                      {avatar.primaryColor === col && (
                        <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gear Color */}
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Combat Gear Highlight</label>
                <div className="flex flex-wrap gap-1.5">
                  {ACCENT_COLORS.map((col) => (
                    <button
                      key={col}
                      onClick={() => setAvatar({ ...avatar, accentColor: col })}
                      style={{ backgroundColor: col }}
                      className="w-6 h-6 rounded-full border-2 border-[#050505] hover:scale-110 active:scale-90 transition-all flex items-center justify-center relative shadow"
                    >
                      {avatar.accentColor === col && (
                        <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleRandomize}
            className="w-full mt-5 py-2.5 bg-[#050505] hover:bg-slate-900 text-xs font-bold text-slate-300 rounded-lg border border-slate-800 transition flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4.5 h-4.5 text-[#22c55e]" />
            Randomize Outfit
          </button>
        </div>

        {/* 4. Controls Guide Card (Columns 5-8, Rows 6-8 equivalent) */}
        <div id="bento-controls" className="md:col-span-6 lg:col-span-4 bg-[#121212] border border-[#1e293b] rounded-[20px] p-6 transition-all duration-300 hover:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-900 mb-3">
              <Keyboard className="text-[#22c55e] w-4 h-4" />
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Lobby Controls Guide
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400 font-medium">Jetpack flight</span>
                <span className="px-1.5 py-0.5 bg-black rounded font-mono border border-slate-800 font-bold text-[#22c55e] text-[10px]">W, A, S, D</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400 font-medium">Aim weapon</span>
                <span className="px-1.5 py-0.5 bg-black rounded font-mono border border-slate-800 font-bold text-[#22c55e] text-[10px]">Mouse cursor</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400 font-medium">Primary shoot</span>
                <span className="px-1.5 py-0.5 bg-black rounded font-mono border border-slate-800 font-bold text-red-400 text-[10px]">Left Click</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400 font-medium">Throw Grenade</span>
                <span className="px-1.5 py-0.5 bg-black rounded font-mono border border-slate-800 font-bold text-teal-400 text-[10px]">Right Click / G</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400 font-medium">Weapon switch</span>
                <span className="px-1.5 py-0.5 bg-black rounded font-mono border border-slate-800 font-bold text-[#22c55e] text-[10px]">Q / E</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400 font-medium">Ammo Reload</span>
                <span className="px-1.5 py-0.5 bg-black rounded font-mono border border-slate-800 font-bold text-white text-[10px]">R</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-medium">Battle Scoreboard</span>
                <span className="px-1.5 py-0.5 bg-black rounded font-mono border border-slate-800 font-bold text-yellow-400 text-[10px]">Hold TAB</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-medium mt-3 border-t border-slate-900 pt-3">
            Press <kbd className="text-[#22c55e] font-mono">ENTER</kbd> within live arenas to chat.
          </div>
        </div>

        {/* 5. Online Squad / Friends Card (Columns 9-12, Rows 4-8 equivalent) */}
        <div id="bento-squad" className="md:col-span-6 lg:col-span-3 bg-[#121212] border border-[#1e293b] rounded-[20px] p-6 transition-all duration-300 hover:border-slate-700">
          <div className="flex items-center justify-between pb-3 border-b border-slate-900 mb-3">
            <div className="flex items-center gap-1.5">
              <Users className="text-[#22c55e] w-4 h-4" />
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Online Squad
              </div>
            </div>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
            </span>
          </div>

          <div className="space-y-3 mt-4">
            {/* Player Row */}
            <div className="flex items-center justify-between py-1 border-b border-slate-950">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span className="font-semibold text-xs text-[#22c55e]">
                  {playerName.trim() || "You"}
                </span>
              </div>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">In Lobby</span>
            </div>

            {/* Friend 1 */}
            <div className="flex items-center justify-between py-1 border-b border-slate-950">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span className="font-semibold text-xs text-slate-300">The_Better_Friend</span>
              </div>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">In Lobby</span>
            </div>

            {/* Friend 2 */}
            <div className="flex items-center justify-between py-1 border-b border-slate-950">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-550 bg-slate-600" />
                <span className="font-semibold text-xs text-slate-500 line-through">Half_Friend_Jim</span>
              </div>
              <span className="text-[9px] text-slate-600 uppercase tracking-widest">Offline</span>
            </div>

            {/* Friend 3 */}
            <div className="flex items-center justify-between py-1 border-b border-slate-950">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span className="font-semibold text-xs text-slate-300">Guest_9042</span>
              </div>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">In Lobby</span>
            </div>

            {/* Friend 4 */}
            <div className="flex items-center justify-between py-1 border-b border-slate-950">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                <span className="font-semibold text-xs text-slate-300">NoobMaster69</span>
              </div>
              <span className="text-[9px] text-yellow-500 uppercase tracking-widest">In Match</span>
            </div>

            {/* Friend 5 */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span className="font-semibold text-xs text-slate-300">Sniper_Wolf</span>
              </div>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">In Lobby</span>
            </div>
          </div>
        </div>

        {/* 6. Combat Record / Stats Card */}
        <div id="bento-stats" className="md:col-span-6 lg:col-span-3 bg-[#121212] border border-[#1e293b] rounded-[20px] p-6 transition-all duration-300 hover:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-900 mb-4">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Combat Record
              </div>
              <Trophy className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="space-y-2 mt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Total Kills</span>
                <span className="font-bold text-[#22c55e] text-sm">
                  {userData?.kills ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Deaths</span>
                <span className="font-bold text-slate-200">
                  {userData?.deaths ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">K/D Ratio</span>
                <span className="font-bold text-[#22c55e]">
                  {userData?.deaths
                    ? (userData.kills / userData.deaths).toFixed(2)
                    : (userData?.kills ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium font-bold">Wins</span>
                <span className="font-bold text-slate-200">{userData?.wins ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center">
            <span className="text-[10px] text-slate-500 font-medium">Overall Season Prestige</span>
            <span className="text-[10px] text-[#22c55e] font-bold">
              Level {Math.max(1, Math.floor((userData?.kills ?? 0) / 25) + 1)}
            </span>
          </div>
        </div>

        {/* 7. Server Status / Green Accent Bento Grid Item Card */}
        <div id="bento-server" className="md:col-span-12 lg:col-span-12 bg-[#22c55e] text-black border-none rounded-[20px] p-6 flex flex-col md:flex-row justify-between items-center gap-4 transition-all duration-300 hover:scale-[1.01] shadow-lg shadow-emerald-500/10">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="text-[10px] font-black uppercase tracking-wider opacity-85 mb-1 text-[#050505]">
              Server Connection
            </div>
            <div className="text-4xl font-black tracking-tighter leading-none mb-1">
              14ms Response
            </div>
            <div className="text-xs font-bold opacity-80">
              Virginia, USA Sandbox Server Node (Route-optimized)
            </div>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-1 font-mono">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-black/15 text-xs font-bold uppercase tracking-wider">
              <Server className="w-3.5 h-3.5" />
              Sandbox Node Ports Active
            </div>
            <div className="text-[10px] font-black opacity-90 uppercase tracking-widest mt-1">
              ALL SYSTEMS OPERATIONAL
            </div>
          </div>
        </div>

      </div>

      <div className="w-full max-w-7xl mx-auto mt-8 mb-4 flex flex-col md:flex-row justify-between items-center gap-3 border-t border-slate-900 pt-4 text-[10px] text-slate-600 font-semibold z-10">
        <div className="flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5" />
          Runs securely on cloud run container sockets.
        </div>
        <div className="flex items-center gap-1 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/10 text-slate-400">
          <span>Developed by:</span>
          <span className="text-emerald-400 font-black tracking-wide uppercase">Subroto Kumar Barman</span>
        </div>
        <div>
          Build Build-v3.0.0
        </div>
      </div>

    </div>
  );
}

