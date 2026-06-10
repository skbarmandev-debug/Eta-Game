import React, { useState } from "react";
import { Swords, Sparkles, LogIn, ChevronRight, BarChart3, Shield, Info, ArrowUpCircle } from "lucide-react";
import { auth, googleProvider, signInWithPopup } from "../firebase";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onLoginSuccess(result.user);
    } catch (err: any) {
      console.error("Sign-in error: ", err);
      setError(err?.message || "Successfully cancelled or failed Google Sign-In.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#050505] text-[#f8fafc] font-sans overflow-y-auto overflow-x-hidden p-6 justify-center items-center relative">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_80%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Decorative center radial glow */}
      <div className="absolute w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 z-10">
        
        {/* Left Side: Game Title and Features Bento */}
        <div className="md:col-span-7 flex flex-col justify-between p-6 bg-[#121212]/30 border border-[#1e293b]/50 rounded-2xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[40px] pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-[#22c55e]/10 rounded-xl border border-[#22c55e]/20 text-[#22c55e]">
                <Swords className="w-6 h-6 animate-pulse" />
              </div>
              <div className="text-xl font-black tracking-tighter text-white">
                ETA <span className="text-[#22c55e]">ONLINE</span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter text-white mb-4 uppercase">
              Tactical 2D <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-[#22c55e]">
                Jetpack Combat
              </span>
            </h1>

            <p className="text-slate-400 text-xs sm:text-sm mb-6 leading-relaxed max-w-md">
              Grab high-velocity rocket thrusters, deploy rifles and rocket launchers, and duel players in custom low-gravity floating sky arenas or deep cavern catacombs.
            </p>

            {/* Bento Bullet Features */}
            <div className="grid grid-cols-1 gap-3.5 mt-2">
              <div className="flex gap-3 bg-[#121212]/60 p-3 rounded-xl border border-[#1e293b] hover:border-emerald-500/30 transition-all">
                <div className="text-[#22c55e] shrink-0 mt-0.5">
                  <ArrowUpCircle className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Unlimited Flight Booster</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Hover indefinitely. Float freely as long as you hold thrusters but fall down into pits with high consequences.</p>
                </div>
              </div>

              <div className="flex gap-3 bg-[#121212]/60 p-3 rounded-xl border border-[#1e293b] hover:border-emerald-500/30 transition-all">
                <div className="text-[#22c55e] shrink-0 mt-0.5">
                  <BarChart3 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Persistent Combat Records</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Log in with Google to automatically track kills, deaths, and win counts dynamically via Firebase Firestore.</p>
                </div>
              </div>

              <div className="flex gap-3 bg-[#121212]/60 p-3 rounded-xl border border-[#1e293b] hover:border-emerald-500/30 transition-all">
                <div className="text-[#22c55e] shrink-0 mt-0.5">
                  <Shield className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Secure Matchmaker Lobby</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Quickly share invite-only lobby URLs to drop in side-by-side with your squad and friends.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-t border-[#1e293b]/50 pt-4">
            <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Powered by Firebase Auth & Firestore Enterprise Sandbox
            </div>
            <div className="flex items-center gap-1 bg-emerald-500/5 px-2.5 py-1 rounded-full border border-emerald-500/10 text-[10px] text-slate-400 font-bold">
              <span>Developed by:</span>
              <span className="text-emerald-400 font-black tracking-wide uppercase">Subroto Kumar Barman</span>
            </div>
          </div>
        </div>

        {/* Right Side: Sign In Card */}
        <div className="md:col-span-5 bg-[#121212] border border-emerald-500/20 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-[0_0_50px_rgba(34,197,94,0.03)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-500/5 pointer-events-none" />

          <div className="mb-8 z-10 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[#22c55e] text-[10px] font-bold uppercase tracking-widest mb-4">
              SECURE ACCESS REQUIRED
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight uppercase">
              Join the Arena
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Authenticate your account using Google to establish your combat profiles and match with online records. No passwords required.
            </p>
          </div>

          <div className="my-6 z-10">
            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-xs text-red-400 leading-normal">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 active:bg-slate-200 disabled:bg-slate-400 text-black text-xs font-black tracking-wide rounded-xl uppercase transition-all flex items-center justify-center gap-3 shadow-lg shadow-white/5 active:scale-[0.98] group cursor-pointer"
            >
              {loading ? (
                <div className="w-4.5 h-4.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              {loading ? "Authenticating..." : "CONTINUE WITH GOOGLE"}
              <ChevronRight className="w-4 h-4 ml-auto text-black transform group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="z-10 bg-[#050505] p-3 rounded-lg border border-[#1e293b]/60 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-ping shrink-0" />
            <div className="text-[10px] text-slate-500 leading-normal font-mono">
              CENTRAL AUTH NODE ONLINE. <br />READY FOR PAYLOAD CONGESTION.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
