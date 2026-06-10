/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Shield, Zap, RefreshCw, Layers, Award, Radio } from "lucide-react";
import { Player, WeaponType, Bullet, Grenade, WeaponDrop, GameMap, WEAPON_DEFAULTS, AvatarConfig } from "../types";
import { getMapById, MAPS } from "../maps";
import { sound } from "../audio";
import { auth, db } from "../firebase";
import { doc, updateDoc, increment } from "firebase/firestore";

interface CanvasGameProps {
  roomId: string;
  playerName: string;
  avatar: AvatarConfig;
  onLeave: () => void;
}

// Particle system helper types
interface GameParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number; // current life
  maxLife: number; // max life frame
  type: "smoke" | "blood" | "spark" | "fire";
}

interface KillFeedEvent {
  id: string;
  victimName: string;
  attackerName: string;
  weaponName: string;
  timestamp: number;
}

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
}

const PLAYER_WIDTH = 36;
const PLAYER_HEIGHT = 46;
const JETPACK_MAX_FUEL = 100;
const GRENADE_RADIUS = 6;

export default function CanvasGame({
  roomId,
  playerName,
  avatar,
  onLeave
}: CanvasGameProps) {
  // UI states
  const [activeMapId, setActiveMapId] = useState<string>("outpost");
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [hudWeapons, setHudWeapons] = useState<any[]>([]);
  const [hudEquippedIdx, setHudEquippedIdx] = useState<number>(0);
  const [hudHealth, setHudHealth] = useState(100);
  const [hudFuel, setHudFuel] = useState(100);
  const [hudGrenades, setHudGrenades] = useState(3);
  const [killFeed, setKillFeed] = useState<KillFeedEvent[]>([]);
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [playerList, setPlayerList] = useState<Player[]>([]);

  // Refs for canvas & socket
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const keyMapRef = useRef<Record<string, boolean>>({});
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });
  const chatOpenRef = useRef(false);

  // Core Game State (Stored inside refs/mutables for lag-free 60FPS loops)
  const localPlayerRef = useRef<Player>({
    id: "",
    name: playerName,
    avatar: avatar,
    x: 400,
    y: 400,
    vx: 0,
    vy: 0,
    angle: 0,
    isFacingLeft: false,
    health: 100,
    jetpackFuel: 100,
    isDead: false,
    respawnTimer: 0,
    equippedWeaponIndex: 0,
    weapons: [
      { type: WeaponType.Pistol, clipAmmo: 7, reserveAmmo: Infinity, isReloading: false, reloadProgress: 0 },
      { type: WeaponType.Rifle, clipAmmo: 30, reserveAmmo: 120, isReloading: false, reloadProgress: 0 }
    ],
    grenadeCount: 3,
    kills: 0,
    deaths: 0,
    ping: 15,
    isJetpacking: false,
    isShooting: false,
    lastActiveTime: Date.now()
  });

  const remotePlayersRef = useRef<Map<string, Player>>(new Map());
  const weaponDropsRef = useRef<WeaponDrop[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const grenadesRef = useRef<Grenade[]>([]);
  const particlesRef = useRef<GameParticle[]>([]);
  const activeMapRef = useRef<GameMap>(getMapById("outpost"));
  const viewOffsetRef = useRef({ x: 0, y: 0 }); // Camera scrolling
  const lastShotTimeRef = useRef<number>(0);
  const currentIdRef = useRef<string | null>(null);

  // Floating overhead chat timers
  const speechBubblesRef = useRef<Map<string, { text: string; timer: number }>>(new Map());

  // Screen Shake effect
  const screenShakeRef = useRef({ intensity: 0, duration: 0 });

  useEffect(() => {
    // Resolve websocket protocol based on schema
    const isSecure = window.location.protocol === "https:";
    const wsPrefix = isSecure ? "wss://" : "ws://";
    const wsUrl = `${wsPrefix}${window.location.host}?room=${roomId}`;

    console.log("Connecting WebSocket to:", wsUrl);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connection established!");
      setConnecting(false);

      // Authenticate / announce join
      socket.send(JSON.stringify({
        type: "join",
        data: {
          roomId,
          playerName,
          avatar
        }
      }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, data } = msg;

        switch (type) {
          case "ping": {
            // Echo ping back to measure roundtrip delay
            socket.send(JSON.stringify({ type: "pong", data: { timestamp: data.timestamp } }));
            break;
          }

          case "init": {
            const { id, players, weaponDrops, mapId } = data;
            setCurrentId(id);
            currentIdRef.current = id;
            localPlayerRef.current.id = id;

            // Load map
            const loadedMap = getMapById(mapId);
            activeMapRef.current = loadedMap;
            setActiveMapId(mapId);

            // Seed initial state
            remotePlayersRef.current.clear();
            players.forEach((p: Player) => {
              if (p.id !== id) {
                remotePlayersRef.current.set(p.id, p);
              } else {
                localPlayerRef.current.kills = p.kills;
                localPlayerRef.current.deaths = p.deaths;
                localPlayerRef.current.weapons = p.weapons;
              }
            });

            // Set drops
            weaponDropsRef.current = weaponDrops;

            // Instantly spawn local player at map safe points
            const pSpawns = loadedMap.spawnPoints.filter(sp => sp.type === "player");
            const sp = pSpawns[Math.floor(Math.random() * pSpawns.length)] || { x: 400, y: 400 };
            localPlayerRef.current.x = sp.x;
            localPlayerRef.current.y = sp.y;
            localPlayerRef.current.vx = 0;
            localPlayerRef.current.vy = 0;
            localPlayerRef.current.health = 100;
            localPlayerRef.current.isDead = false;
            localPlayerRef.current.respawnTimer = 0;

            break;
          }

          case "player_joined": {
            const { player } = data;
            if (player.id !== currentIdRef.current) {
              remotePlayersRef.current.set(player.id, player);
              addSystemChat(`${player.name} joined the fight!`);
            }
            break;
          }

          case "player_left": {
            const { id } = data;
            const quitting = remotePlayersRef.current.get(id);
            if (quitting) {
              addSystemChat(`${quitting.name} disconnected.`);
              remotePlayersRef.current.delete(id);
              speechBubblesRef.current.delete(id);
            }
            break;
          }

          case "tick": {
            const { players, weaponDrops } = data;
            
            // Sync remote players positions gracefully
            players.forEach((p: Player) => {
              if (p.id === currentIdRef.current) {
                // Sync scoreboard scores from authority server
                localPlayerRef.current.kills = p.kills;
                localPlayerRef.current.deaths = p.deaths;
                localPlayerRef.current.ping = p.ping;
              } else {
                // Smooth interpolation can be handled, but simple rewrite is highly efficient
                remotePlayersRef.current.set(p.id, p);
              }
            });

            // Update items positions/availabilities
            weaponDropsRef.current = weaponDrops;

            // Force update react state triggers for scoreboard or HUD occasionally
            const allPlayers = [localPlayerRef.current, ...Array.from(remotePlayersRef.current.values())];
            setPlayerList(allPlayers);
            break;
          }

          case "fire_bullet": {
            const { bullet } = data;
            // Draw bullet tracer on local canvas
            bulletsRef.current.push(bullet);

            // Play gun shot synthetically for this weapon
            triggerWeaponAudio(bullet.weaponType);
            break;
          }

          case "spawn_grenade": {
            const { grenade } = data;
            grenadesRef.current.push(grenade);
            break;
          }

          case "explosion": {
            const { x, y, dmgRadius, type } = data;
            // Create particle explosion
            createExplosionParticles(x, y, type === "rocket" ? 40 : 25);
            sound.playExplosion();

            // Trigger screen trembles!
            screenShakeRef.current = { intensity: type === "rocket" ? 12 : 7, duration: 18 };
            break;
          }

          case "blood_spill": {
            const { x, y, count, dirX, dirY } = data;
            createBloodParticles(x, y, count, dirX, dirY);
            break;
          }

          case "player_damaged": {
            const { targetId, damage, attackerId } = data;
            if (targetId === currentIdRef.current) {
              // I got damaged!
              localPlayerRef.current.health = Math.max(0, localPlayerRef.current.health - damage);
              sound.playPlayerHurt();
              createBloodParticles(localPlayerRef.current.x, localPlayerRef.current.y, 8, 0, -1);

              if (localPlayerRef.current.health <= 0 && !localPlayerRef.current.isDead) {
                handlePlayerDeath(attackerId);
              }
            } else {
              // Remote player took damage, draw blood splatter
              const victim = remotePlayersRef.current.get(targetId);
              if (victim) {
                createBloodParticles(victim.x, victim.y, 5, 0, -1);
              }
            }
            break;
          }

          case "player_died": {
            const { victimId, attackerId, weaponName } = data;
            const victim = victimId === currentIdRef.current ? localPlayerRef.current : remotePlayersRef.current.get(victimId);
            const attacker = attackerId === currentIdRef.current ? localPlayerRef.current : remotePlayersRef.current.get(attackerId);

            if (victim) {
              victim.isDead = true;
              victim.health = 0;
              // Visual red blood splat on ground
              createBloodParticles(victim.x, victim.y, 35, 0, 0);
            }

            // Sync permanent combat stats to Firebase Firestore
            if (auth.currentUser) {
              const userRef = doc(db, "users", auth.currentUser.uid);
              if (victimId === currentIdRef.current) {
                updateDoc(userRef, {
                  deaths: increment(1),
                  updatedAt: new Date().toISOString()
                }).catch(err => console.error("Could not write death stat:", err));
              }
              if (attackerId === currentIdRef.current && victimId !== attackerId) {
                updateDoc(userRef, {
                  kills: increment(1),
                  updatedAt: new Date().toISOString()
                }).catch(err => console.error("Could not write kill stat:", err));
              }
            }

            // Append kill notification
            const newKill: KillFeedEvent = {
              id: Math.random().toString(),
              victimName: victim ? victim.name : "Recruit",
              attackerName: attacker ? attacker.name : "Recruit",
              weaponName,
              timestamp: Date.now()
            };
            setKillFeed(prev => [newKill, ...prev.slice(0, 4)]);

            // Auto clean killfeed after 6 seconds
            setTimeout(() => {
              setKillFeed(prev => prev.filter(k => k.id !== newKill.id));
            }, 60000 / 10);
            break;
          }

          case "pickup_weapon": {
            const { playerId, dropId, equippedIndex, newWeaponType, oldWeaponDrop } = data;
            
            // Log audio
            sound.playPickup();

            if (playerId === currentIdRef.current) {
              // Local player grabbed floor guns
              const lp = localPlayerRef.current;
              lp.weapons[equippedIndex] = {
                type: newWeaponType,
                clipAmmo: WEAPON_DEFAULTS[newWeaponType].clipSize,
                reserveAmmo: WEAPON_DEFAULTS[newWeaponType].ammoCap,
                isReloading: false,
                reloadProgress: 0
              };
              setHudWeapons([...lp.weapons]);
            } else {
              // Remote player grabbed
              const rp = remotePlayersRef.current.get(playerId);
              if (rp) {
                rp.weapons[equippedIndex] = {
                  type: newWeaponType,
                  clipAmmo: WEAPON_DEFAULTS[newWeaponType].clipSize,
                  reserveAmmo: WEAPON_DEFAULTS[newWeaponType].ammoCap,
                  isReloading: false,
                  reloadProgress: 0
                };
              }
            }
            break;
          }

          case "chat": {
            const { senderId, senderName, text } = data;
            const newMessage: ChatMessage = {
              id: Math.random().toString(),
              senderName,
              text,
              timestamp: Date.now()
            };
            setChatLog(prev => [...prev.slice(-30), newMessage]);

            // Assign overhead bubble
            speechBubblesRef.current.set(senderId, { text, timer: 120 }); // Displays for ~2 seconds (120 render frames)
            break;
          }
        }
      } catch (err) {
        console.error("Critical parse error during client messaging:", err);
      }
    };

    socket.onerror = (e) => {
      console.error("Socket communications exception:", e);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed.");
    };

    return () => {
      socket.close();
    };
  }, [roomId, playerName]);

  // Audio helper function mapping
  const triggerWeaponAudio = (type: WeaponType) => {
    if (type === WeaponType.Pistol) sound.playPistol();
    else if (type === WeaponType.Rifle) sound.playRifle();
    else if (type === WeaponType.Shotgun) sound.playShotgun();
    else if (type === WeaponType.Sniper) sound.playSniper();
    else if (type === WeaponType.RocketLauncher) sound.playRocket();
  };

  // Chat actions
  const addSystemChat = (txt: string) => {
    setChatLog(prev => [...prev, { id: Math.random().toString(), senderName: "SYSTEM", text: txt, timestamp: Date.now() }]);
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !socketRef.current) return;
    socketRef.current.send(JSON.stringify({
      type: "chat",
      data: { text: chatInput.trim() }
    }));
    setChatInput("");
    setChatOpen(false);
    chatOpenRef.current = false;
  };

  // Trigger map change broadcast
  const handleMapChangeRequest = (mapId: string) => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({
      type: "change_map",
      data: { mapId }
    }));
  };

  // Local death resolution
  const handlePlayerDeath = (attackerId: string) => {
    const lp = localPlayerRef.current;
    lp.isDead = true;
    lp.health = 0;
    lp.respawnTimer = 4; // 4 seconds delay
    sound.playPlayerHurt();

    const activeGun = lp.weapons[lp.equippedWeaponIndex].type;

    // Send death notifications to the authority server
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "player_died",
        data: {
          victimId: lp.id,
          attackerId,
          weaponName: attackerId === lp.id ? "Gravity Abyss" : WEAPON_DEFAULTS[activeGun].name
        }
      }));
    }
  };

  // Respawn coordinates loader
  const executeRespawn = () => {
    const lp = localPlayerRef.current;
    const map = activeMapRef.current;
    
    const pSpawns = map.spawnPoints.filter(sp => sp.type === "player");
    const sp = pSpawns[Math.floor(Math.random() * pSpawns.length)] || { x: 400, y: 400 };

    lp.x = sp.x;
    lp.y = sp.y;
    lp.vx = 0;
    lp.vy = 0;
    lp.health = 100;
    lp.jetpackFuel = 100;
    lp.isDead = false;
    lp.respawnTimer = 0;
    lp.weapons.forEach(w => {
      w.clipAmmo = WEAPON_DEFAULTS[w.type].clipSize;
      w.reserveAmmo = w.type === WeaponType.Pistol ? Infinity : WEAPON_DEFAULTS[w.type].ammoCap;
      w.isReloading = false;
    });
    lp.grenadeCount = 3;

    setHudHealth(100);
    setHudFuel(100);
    setHudGrenades(3);
  };

  // Rendering particles generator helper
  const createExplosionParticles = (x: number, y: number, count: number) => {
    // Generate fire particles
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? "#ef4444" : "#f97316", // red/orange flames
        size: Math.random() * 10 + 4,
        alpha: 1.0,
        life: 0,
        maxLife: Math.random() * 25 + 15,
        type: "fire"
      });
    }

    // Dense smoke clouds
    for (let i = 0; i < Math.floor(count * 0.7); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: "#475569", // slate gray charcoal smoke
        size: Math.random() * 16 + 8,
        alpha: 0.8,
        life: 0,
        maxLife: Math.random() * 40 + 20,
        type: "smoke"
      });
    }

    // Yellow sparks
    for (let i = 0; i < Math.floor(count * 0.5); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: "#eab308", // bright yellow shards
        size: Math.random() * 3 + 1,
        alpha: 1.0,
        life: 0,
        maxLife: Math.random() * 15 + 10,
        type: "spark"
      });
    }
  };

  const createBloodParticles = (x: number, y: number, count: number, dX: number, dY: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const force = Math.random() * 4 + 1;
      particlesRef.current.push({
        x,
        y: y - 10, // splatter from middle
        vx: (dX * 2) + Math.cos(angle) * force,
        vy: (dY * 2) + Math.sin(angle) * force - 1, // slight upwards splash
        color: "#991b1b", // Deep wet blood
        size: Math.random() * 5 + 2,
        alpha: 0.9,
        life: 0,
        maxLife: Math.random() * 30 + 30, // lives slightly longer to settle
        type: "blood"
      });
    }
  };

  // Keyboard, Mouse, Weapon interactions & Main Canvas game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions fluidly
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Dynamic keyboard registers
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // If typing in chat, don't capture gameplay triggers unless ENTER key
      if (chatOpenRef.current) {
        if (e.key === "Enter") {
          sendChatMessage();
        } else if (e.key === "Escape") {
          setChatOpen(false);
          chatOpenRef.current = false;
        }
        return;
      }

      if (e.key === "Enter") {
        setChatInput("");
        setChatOpen(true);
        chatOpenRef.current = true;
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        setShowScoreboard(true);
        return;
      }

      // Quick weapon swaps
      if (key === "q" || key === "e") {
        cycleWeapon();
        return;
      }

      // Quick Grenade trigger
      if (key === "g") {
        throwGrenade();
        return;
      }

      // Manual reload trigger
      if (key === "r") {
        triggerReload();
        return;
      }

      keyMapRef.current[key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.key === "Tab") {
        setShowScoreboard(false);
      }
      keyMapRef.current[key] = false;
    };

    // Tracking mouse aims
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      // Mouse coordinates relative to top-left of canvas
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (chatOpenRef.current) return;
      if (e.button === 0) {
        mouseRef.current.isDown = true;
      } else if (e.button === 2) {
        e.preventDefault();
        throwGrenade();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseRef.current.isDown = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("contextmenu", handleContextMenu);

    // --- GAMEPLAY METHODS ---

    // Swap weapons Q/E
    const cycleWeapon = () => {
      const lp = localPlayerRef.current;
      if (lp.isDead) return;
      
      const newIdx = (lp.equippedWeaponIndex + 1) % lp.weapons.length;
      lp.equippedWeaponIndex = newIdx;
      setHudEquippedIdx(newIdx);

      // Play click sound
      sound.playReload();

      // Interrupt reload
      const currentGun = lp.weapons[newIdx];
      if (currentGun.isReloading) {
        currentGun.isReloading = false;
        currentGun.reloadProgress = 0;
      }
    };

    // Reload trigger
    const triggerReload = () => {
      const lp = localPlayerRef.current;
      if (lp.isDead) return;
      const gun = lp.weapons[lp.equippedWeaponIndex];
      const stats = WEAPON_DEFAULTS[gun.type];

      // No need if already reloading, or clip full, or no ammo left
      if (gun.isReloading || gun.clipAmmo === stats.clipSize || gun.reserveAmmo === 0) return;

      gun.isReloading = true;
      gun.reloadProgress = 0;
      sound.playReload();
    };

    // Weapon fire action
    const fireActiveWeapon = () => {
      const lp = localPlayerRef.current;
      if (lp.isDead) return;

      const weaponState = lp.weapons[lp.equippedWeaponIndex];
      const stats = WEAPON_DEFAULTS[weaponState.type];

      if (weaponState.isReloading) return;

      // Check empty clips
      if (weaponState.clipAmmo <= 0) {
        triggerReload();
        return;
      }

      const now = Date.now();
      if (now - lastShotTimeRef.current < stats.fireRate) return;

      lastShotTimeRef.current = now;

      // Subtract bullet count
      weaponState.clipAmmo--;

      // Capture sound
      triggerWeaponAudio(weaponState.type);

      // Calculate shooting vector based on angle
      // Visual mouth of muzzle: spawn bullet slightly in front of player
      const baseAngle = lp.angle;
      const muzzleX = lp.x + Math.cos(baseAngle) * 22;
      const muzzleY = lp.y - 12 + Math.sin(baseAngle) * 22;

      // Handle custom shotgun spread (fires 5 small pellets simultaneously!)
      if (weaponState.type === WeaponType.Shotgun) {
        const pelletCount = 5;
        for (let i = 0; i < pelletCount; i++) {
          const spreadAngle = baseAngle + (Math.random() - 0.5) * stats.spread;
          const velocityX = Math.cos(spreadAngle) * stats.speed;
          const velocityY = Math.sin(spreadAngle) * stats.speed;
          const bId = `bullet_${lp.id}_${now}_${i}_${Math.random().toString(36).substring(2, 5)}`;

          const b: Bullet = {
            id: bId,
            senderId: lp.id,
            x: muzzleX,
            y: muzzleY,
            vx: velocityX,
            vy: velocityY,
            weaponType: WeaponType.Shotgun,
            damage: stats.damage,
            createdAt: now,
            isPellet: true
          };

          bulletsRef.current.push(b);
          // Sync shooting vector to peers on WebSocket
          if (socketRef.current) {
            socketRef.current.send(JSON.stringify({ type: "fire_bullet", data: { bullet: b } }));
          }
        }
      } else {
        // Standard normal rifle / pistol / sniper shots
        const spreadAngle = baseAngle + (Math.random() - 0.5) * stats.spread;
        const velocityX = Math.cos(spreadAngle) * stats.speed;
        const velocityY = Math.sin(spreadAngle) * stats.speed;
        const bId = `bullet_${lp.id}_${now}_${Math.random().toString(36).substring(2, 5)}`;

        const b: Bullet = {
          id: bId,
          senderId: lp.id,
          x: muzzleX,
          y: muzzleY,
          vx: velocityX,
          vy: velocityY,
          weaponType: weaponState.type,
          damage: stats.damage,
          createdAt: now
        };

        bulletsRef.current.push(b);

        // Send fire bullet packet over WS
        if (socketRef.current) {
          socketRef.current.send(JSON.stringify({
            type: "fire_bullet",
            data: { bullet: b }
          }));
        }
      }

      // Kickback recoil physics feedback!
      lp.vx -= Math.cos(baseAngle) * (stats.type === WeaponType.Sniper ? 5 : stats.type === WeaponType.RocketLauncher ? 8 : stats.type === WeaponType.Shotgun ? 4 : 0.8);
      lp.vy -= Math.sin(baseAngle) * (stats.type === WeaponType.Sniper ? 3 : stats.type === WeaponType.RocketLauncher ? 6 : stats.type === WeaponType.Shotgun ? 2 : 0.4);

      // Trigger weapon updates
      setHudWeapons([...lp.weapons]);
    };

    // Handle Grenade throwing logic
    const throwGrenade = () => {
      const lp = localPlayerRef.current;
      if (lp.isDead || lp.grenadeCount <= 0) return;

      lp.grenadeCount--;
      setHudGrenades(lp.grenadeCount);

      const baseAngle = lp.angle;
      const throwX = lp.x + Math.cos(baseAngle) * 20;
      const throwY = lp.y - 12 + Math.sin(baseAngle) * 20;
      
      const throwForce = 9.5;
      const velocityX = Math.cos(baseAngle) * throwForce + lp.vx * 0.4;
      const velocityY = Math.sin(baseAngle) * throwForce + lp.vy * 0.4 - 2; // Throw slightly arc curve upwards
      const now = Date.now();
      const gId = `grenade_${lp.id}_${now}_${Math.random().toString(36).substring(2, 5)}`;

      const grenadeObj: Grenade = {
        id: gId,
        senderId: lp.id,
        x: throwX,
        y: throwY,
        vx: velocityX,
        vy: velocityY,
        timer: 2300 // Explodes in 2.3 seconds
      };

      grenadesRef.current.push(grenadeObj);

      // Sync grenade throw
      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: "spawn_grenade",
          data: { grenade: grenadeObj }
        }));
      }
    };

    // --- GAME ENGINE LOOP (Runs at solid 60FPS) ---
    let frameId: number;

    const gameLoop = () => {
      const lp = localPlayerRef.current;
      const m = activeMapRef.current;

      // Handle screen tremor reductions
      if (screenShakeRef.current.duration > 0) {
        screenShakeRef.current.duration--;
        if (screenShakeRef.current.duration === 0) {
          screenShakeRef.current.intensity = 0;
        }
      }

      // 1. INPUT HANDLING FOR LOCAL PLAYER (Only if alive)
      if (!lp.isDead) {
        // Lateral runs
        const isA = keyMapRef.current["a"] || keyMapRef.current["arrowleft"];
        const isD = keyMapRef.current["d"] || keyMapRef.current["arrowright"];
        const walkSpeed = 2.4;

        if (isA) {
          lp.vx = -walkSpeed;
          lp.isFacingLeft = true;
        } else if (isD) {
          lp.vx = walkSpeed;
          lp.isFacingLeft = false;
        } else {
          // Slide friction decay
          lp.vx *= 0.74;
        }

         // Jump & Jetpack Boots
         const isUp = keyMapRef.current["w"] || keyMapRef.current[" "] || keyMapRef.current["arrowup"];
         if (isUp) {
           // Thruster acceleration upwards
           lp.vy -= 0.65;
           lp.jetpackFuel = 100; // Unlimited jetpack boots flight fuel
           lp.isJetpacking = true;
 
           // Sound trigger for boots sizzle
           sound.setJetpackActive(true);
 
           // Emit jetpack smoke fuel exhaust
           if (Math.random() < 0.45) {
             particlesRef.current.push({
               x: lp.x - (lp.isFacingLeft ? -6 : 14),
               y: lp.y + 12,
               vx: (lp.isFacingLeft ? -1 : 1) * 2 + (Math.random() - 0.5) * 1.5,
               vy: 3.5 + Math.random() * 2,
               color: Math.random() < 0.5 ? "#f97316" : "#64748b", // orange fires / gray fumes
               size: Math.random() * 6 + 3,
               alpha: 0.8,
               life: 0,
               maxLife: Math.random() * 20 + 10,
               type: "smoke"
             });
           }
         } else {
           lp.isJetpacking = false;
           // Quiet boots thrusters audio
           sound.setJetpackActive(false);
           lp.jetpackFuel = 100; // Keep full when resting
         }

        // Mouse angle calculations
        const screenX = lp.x - viewOffsetRef.current.x;
        const screenY = lp.y - viewOffsetRef.current.y;
        lp.angle = Math.atan2(mouseRef.current.y - (screenY - 12), mouseRef.current.x - screenX);

        // Check weapon reloading animations
        const gun = lp.weapons[lp.equippedWeaponIndex];
        if (gun.isReloading) {
          const stats = WEAPON_DEFAULTS[gun.type];
          gun.reloadProgress += 1000 / (stats.reloadTime * 60); // Progress tick rate depending on 60FPS
          
          if (gun.reloadProgress >= 1.0) {
            gun.isReloading = false;
            gun.reloadProgress = 0;
            const toLoad = Math.min(stats.clipSize - gun.clipAmmo, gun.reserveAmmo);
            gun.clipAmmo += toLoad;
            if (gun.reserveAmmo !== Infinity) {
              gun.reserveAmmo -= toLoad;
            }
            setHudWeapons([...lp.weapons]);
          }
        } else if (gun.clipAmmo === 0 && gun.reserveAmmo > 0) {
          // Automatic reload when magazine is empty
          triggerReload();
        }

        // Handle continuous weapon shooting (automatic assault weapons like Rifle)
        if (mouseRef.current.isDown) {
          lp.isShooting = true;
          const currentStats = WEAPON_DEFAULTS[gun.type];
          if (currentStats.type === WeaponType.Rifle) {
            fireActiveWeapon();
          } else {
            // Semi-automatics require tapping, fire once per click
            fireActiveWeapon();
            mouseRef.current.isDown = false; // reset
          }
        } else {
          lp.isShooting = false;
        }

        // Apply environment gravity
        lp.vy += m.gravity;

        // Velocity ceilings
        lp.vx = Math.max(-10, Math.min(10, lp.vx));
        lp.vy = Math.max(-12, Math.min(12, lp.vy));

        // Apply velocity to position
        lp.x += lp.vx;
        lp.y += lp.vy;

        // Let's resolve dynamic map collision walls for Local Player
        resolveStaticCollisions(lp, m);

        // Falling Out of Bounds Death Check
        if (!lp.isDead && lp.y > m.height + 150) {
          lp.health = 0;
          handlePlayerDeath(lp.id);
        }

        // Periodically emit local character coordinates down websocket stream
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: "player_update",
            data: {
              x: lp.x,
              y: lp.y,
              vx: lp.vx,
              vy: lp.vy,
              angle: lp.angle,
              isFacingLeft: lp.isFacingLeft,
              health: lp.health,
              jetpackFuel: lp.jetpackFuel,
              isDead: lp.isDead,
              respawnTimer: lp.respawnTimer,
              weapons: lp.weapons,
              equippedWeaponIndex: lp.equippedWeaponIndex,
              grenadeCount: lp.grenadeCount,
              isJetpacking: lp.isJetpacking,
              isShooting: lp.isShooting
            }
          }));
        }

        // Sync local stats to hud gauges
        setHudHealth(lp.health);
        setHudFuel(lp.jetpackFuel);
      } else {
        // If local player is dead, process respawning counts
        sound.setJetpackActive(false);
        lp.vx = 0;
        lp.vy = 0;

        if (lp.respawnTimer > 0) {
          lp.respawnTimer -= 1 / 60; // decrement at 60Hz
          if (lp.respawnTimer <= 0) {
            executeRespawn();
          }
        }
      }

      // 2. PROCESS ACTIVE BULLETS PHYSICS & HITS (Managed purely client-side)
      for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
        const b = bulletsRef.current[i];
        b.x += b.vx;
        b.y += b.vy;

        // Check bullet timeout (approx 3 seconds / 180 frames)
        if (Date.now() - b.createdAt > 3000) {
          bulletsRef.current.splice(i, 1);
          continue;
        }

        // Check if bullet strikes solid brick layers
        let struckBrick = false;
        for (const rect of m.rects) {
          if (rect.type === "solid") {
            if (b.x >= rect.x && b.x <= rect.x + rect.width && b.y >= rect.y && b.y <= rect.y + rect.height) {
              struckBrick = true;
              break;
            }
          }
        }

        if (struckBrick) {
          // Emit concrete sparks!
          createBrickSparks(b.x, b.y, b.vx, b.vy);
          
          // Rocket launcher explosions!
          if (b.weaponType === WeaponType.RocketLauncher) {
            detonateRocket(b.x, b.y, b.senderId);
          }

          bulletsRef.current.splice(i, 1);
          continue;
        }

        // Check direct player hits (Only calculate hits for MYSELF so network remains robust!)
        if (!lp.isDead && b.senderId !== lp.id) {
          const hitLp = checkCircleAABBIntersection(b.x, b.y, 4, lp.x, lp.y, PLAYER_WIDTH, PLAYER_HEIGHT);
          if (hitLp) {
            // Draw blood splatter
            createBloodParticles(b.x, b.y, 8, b.vx * 0.15, b.vy * 0.15);
            bulletsRef.current.splice(i, 1);

            // Report bullet hit to backend socket
            if (socketRef.current) {
              socketRef.current.send(JSON.stringify({
                type: "player_damaged",
                data: {
                  targetId: lp.id,
                  damage: b.damage,
                  attackerId: b.senderId
                }
              }));
            }

            // Rocket detonation
            if (b.weaponType === WeaponType.RocketLauncher) {
              detonateRocket(b.x, b.y, b.senderId);
            }
            continue;
          }
        }
      }

      // 3. PROCESS GRENADES MECHANICS (Bouncing & Detonation)
      for (let i = grenadesRef.current.length - 1; i >= 0; i--) {
        const g = grenadesRef.current[i];
        g.vy += m.gravity * 0.8; // slightly lighter gravity for throws
        g.x += g.vx;
        g.y += g.vy;
        g.timer -= 1000 / 60; // 1 frame count

        // Drag/friction in air
        g.vx *= 0.98;

        // Perform bouncing collision against map elements
        for (const rect of m.rects) {
          if (rect.type === "solid") {
            if (g.x + GRENADE_RADIUS >= rect.x && g.x - GRENADE_RADIUS <= rect.x + rect.width &&
                g.y + GRENADE_RADIUS >= rect.y && g.y - GRENADE_RADIUS <= rect.y + rect.height) {
              
              // Simple bounce reflection
              const overlapX = Math.min(g.x + GRENADE_RADIUS - rect.x, rect.x + rect.width - (g.x - GRENADE_RADIUS));
              const overlapY = Math.min(g.y + GRENADE_RADIUS - rect.y, rect.y + rect.height - (g.y - GRENADE_RADIUS));

              if (overlapX < overlapY) {
                // Bounce horizontal
                g.vx = -g.vx * 0.55;
                g.x += g.vx > 0 ? overlapX : -overlapX;
              } else {
                // Bounce vertical
                g.vy = -g.vy * 0.5;
                g.y += g.vy > 0 ? overlapY : -overlapY;
              }
              
              // Retain slider friction on walls
              g.vx *= 0.9;
            }
          }
        }

        // If countdown expires, trigger heavy splash damage explosion
        if (g.timer <= 0) {
          detonateGrenade(g.x, g.y, g.senderId);
          grenadesRef.current.splice(i, 1);
        }
      }

      // 4. WEAPON DROP COLLISION & AUTOMATIC EQUIPS
      if (!lp.isDead) {
        weaponDropsRef.current.forEach(drop => {
          if (drop.respawnTime === 0) { // Active on floor
            const intersecting = checkCircleAABBIntersection(drop.x, drop.y, 16, lp.x, lp.y, PLAYER_WIDTH, PLAYER_HEIGHT);
            if (intersecting) {
              // Trigger automatic pickup swap if slot doesn't matches or secondary is empty
              // Check if player already carries this exact gun. If they do, they replenish clip reserve ammo!
              const carriedGunIdx = lp.weapons.findIndex(w => w.type === drop.type);
              
              if (carriedGunIdx !== -1) {
                // Max out reserves, reload clicks
                const carried = lp.weapons[carriedGunIdx];
                const limit = WEAPON_DEFAULTS[carried.type].ammoCap;
                if (carried.reserveAmmo < limit) {
                  carried.reserveAmmo = Math.min(limit, carried.reserveAmmo + WEAPON_DEFAULTS[carried.type].clipSize * 2);
                  sound.playPickup();
                  // Tell server to claim floor weapon so it triggers respawn timer
                  if (socketRef.current) {
                    socketRef.current.send(JSON.stringify({
                      type: "pickup_weapon",
                      data: { dropId: drop.id, equippedIndex: carriedGunIdx }
                    }));
                  }
                }
              } else {
                // Swap current active slot
                const slotsIdx = lp.equippedWeaponIndex;
                const oldGun = lp.weapons[slotsIdx];

                // Send swap weapon packet, telling server what weapon we throw back on ground at this point
                if (socketRef.current) {
                  socketRef.current.send(JSON.stringify({
                    type: "pickup_weapon",
                    data: {
                      dropId: drop.id,
                      equippedIndex: slotsIdx,
                      replacedWeaponType: oldGun.type,
                      replacedWeaponClip: oldGun.clipAmmo,
                      replacedWeaponReserve: oldGun.reserveAmmo
                    }
                  }));
                }
              }
            }
          }
        });
      }

      // 5. UPDATE PARTICLES & SMOKES
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        if (p.type === "blood") {
          // Pull down blood particles with slight gravity
          p.vy += 0.12;
        }

        p.alpha = 1.0 - (p.life / p.maxLife);

        if (p.life >= p.maxLife) {
          particlesRef.current.splice(i, 1);
        }
      }

      // 6. OVERHEAD TEXT SPEECH BUBBLES DECEMENTS
      speechBubblesRef.current.forEach((val, id) => {
        val.timer--;
        if (val.timer <= 0) {
          speechBubblesRef.current.delete(id);
        }
      });

      // 7. CAMERA POSITION MATH WITH LEADING OFFSET (Scroll Lerping)
      const targetCamX = lp.x - canvas.width / 2;
      const targetCamY = (lp.y - 12) - canvas.height / 2;
      
      const lerpSpeed = 0.085;
      viewOffsetRef.current.x += (targetCamX - viewOffsetRef.current.x) * lerpSpeed;
      viewOffsetRef.current.y += (targetCamY - viewOffsetRef.current.y) * lerpSpeed;

      // Restrict camera inside boundary edges of active maps
      viewOffsetRef.current.x = Math.max(0, Math.min(m.width - canvas.width, viewOffsetRef.current.x));
      viewOffsetRef.current.y = Math.max(0, Math.min(m.height - canvas.height, viewOffsetRef.current.y));

      // 8. CANVAS RENDERING
      renderGameFrame(ctx, canvas.width, canvas.height, m);

      frameId = requestAnimationFrame(gameLoop);
    };

    // Concrete hits sparks
    const createBrickSparks = (x: number, y: number, bVx: number, bVy: number) => {
      const pCount = 5;
      for (let i = 0; i < pCount; i++) {
        // sparks scatter opposite to bullet speed
        particlesRef.current.push({
          x,
          y,
          vx: -bVx * 0.2 + (Math.random() - 0.5) * 2,
          vy: -bVy * 0.2 + (Math.random() - 0.5) * 2 - 0.5,
          color: "#cbd5e1", // light concrete sparks
          size: Math.random() * 2.5 + 1,
          alpha: 1,
          life: 0,
          maxLife: Math.random() * 14 + 6,
          type: "spark"
        });
      }
    };

    // Rocket launcher blast radius calculation
    const detonateRocket = (bx: number, by: number, attackerId: string) => {
      const radius = 110;
      const lp = localPlayerRef.current;

      // Broadcast blowup explosion
      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: "explosion",
          data: { x: bx, y: by, dmgRadius: radius, type: "rocket" }
        }));
      }

      sound.playExplosion();
      createExplosionParticles(bx, by, 32);

      // Trembles
      screenShakeRef.current = { intensity: 12, duration: 18 };

      // Apply splash radius hits to local player only
      if (!lp.isDead) {
        const dx = lp.x - bx;
        const dy = (lp.y - 12) - by;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < radius) {
          // Linear fallout curve damage calculation
          const factor = 1.0 - (dist / radius);
          const dmg = Math.floor(75 * factor);
          
          if (dmg > 5) {
            // Apply push knockback
            const force = (radius - dist) * 0.085;
            lp.vx += (dx / dist) * force;
            lp.vy += (dy / dist) * force - 2.5;

            if (socketRef.current) {
              socketRef.current.send(JSON.stringify({
                type: "player_damaged",
                data: {
                  targetId: lp.id,
                  damage: dmg,
                  attackerId
                }
              }));
            }
          }
        }
      }
    };

    // Fragmentation Grenade explosion radius calculations
    const detonateGrenade = (gx: number, gy: number, attackerId: string) => {
      const radius = 130;
      const lp = localPlayerRef.current;

      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: "explosion",
          data: { x: gx, y: gy, dmgRadius: radius, type: "grenade" }
        }));
      }

      sound.playExplosion();
      createExplosionParticles(gx, gy, 25);

      screenShakeRef.current = { intensity: 8, duration: 15 };

      if (!lp.isDead) {
        const dx = lp.x - gx;
        const dy = (lp.y - 12) - gy;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < radius) {
          const factor = 1.0 - (dist / radius);
          const dmg = Math.floor(90 * factor); // Grenades are highly lethal at point blank!
          
          if (dmg > 5) {
            const force = (radius - dist) * 0.095;
            lp.vx += (dx / dist) * force;
            lp.vy += (dy / dist) * force - 2;

            if (socketRef.current) {
              socketRef.current.send(JSON.stringify({
                type: "player_damaged",
                data: {
                  targetId: lp.id,
                  damage: dmg,
                  attackerId
                }
              }));
            }
          }
        }
      }
    };

    frameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      
      try {
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("contextmenu", handleContextMenu);
      } catch (err) {}
    };
  }, [connecting, activeMapId]);

  // Collisions mathematical bounding resolution
  const resolveStaticCollisions = (player: Player, map: GameMap) => {
    // 1. BOUNDARY RESTRICTIONS
    if (player.x < 20) {
      player.x = 20;
      player.vx = 0;
    } else if (player.x > map.width - 20) {
      player.x = map.width - 20;
      player.vx = 0;
    }

    if (player.y < 40) {
      player.y = 40;
      player.vy = 0;
    } else if (player.y > map.height + 20) {
      // Fell off map inside sky boundaries!
      player.health = 0;
      handlePlayerDeath(player.id); // count as self suicide
    }

    // 2. RECTANGULAR COLLISION DECAYS
    const hw = PLAYER_WIDTH / 2;
    const hh = PLAYER_HEIGHT; // Box anchored at top or head

    for (const rect of map.rects) {
      // Check collision
      const boxLeft = player.x - hw;
      const boxRight = player.x + hw;
      const boxTop = player.y - hh;
      const boxBottom = player.y;

      const intersects = boxRight > rect.x && boxLeft < rect.x + rect.width &&
                         boxBottom > rect.y && boxTop < rect.y + rect.height;

      if (intersects) {
        if (rect.type === "deadly") {
          // LAVA OR TOXIC ACID COLLISION! Instantly detonate player
          player.health = 0;
          handlePlayerDeath(player.id);
          break;
        }

        if (rect.type === "solid") {
          // Resolve AABB penetration depths
          const overlapLeft = boxRight - rect.x;
          const overlapRight = (rect.x + rect.width) - boxLeft;
          const overlapTop = boxBottom - rect.y;
          const overlapBottom = (rect.y + rect.height) - boxTop;

          // Find the minimum penetration vector, slide player accordingly
          const minPen = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          if (minPen === overlapTop) {
            // Landed on roof of block
            player.y = rect.y;
            player.vy = 0;
          } else if (minPen === overlapBottom) {
            // Bumped head under block ceiling
            player.y = rect.y + rect.height + hh;
            player.vy = Math.max(0.1, -player.vy * 0.2); // bounce slightly downwards
          } else if (minPen === overlapLeft) {
            // Slide outer left wall
            player.x = rect.x - hw;
            player.vx = 0;
          } else if (minPen === overlapRight) {
            // Slide outer right wall
            player.x = rect.x + rect.width + hw;
            player.vx = 0;
          }
        } else if (rect.type === "platform") {
          // Semi-permeable wood walkways (can crawl up from bottom but land on top)
          const pxBeforeBottom = player.y - player.vy;
          if (pxBeforeBottom <= rect.y && player.vy >= 0 && (boxBottom - rect.y < 12)) {
            player.y = rect.y;
            player.vy = 0;
          }
        }
      }
    }
  };

  const checkCircleAABBIntersection = (
    cx: number, cy: number, r: number,
    rx: number, ry: number, rw: number, rh: number
  ) => {
    // Find closest horizontal point
    const closestX = Math.max(rx - rw/2, Math.min(cx, rx + rw/2));
    const closestY = Math.max(ry - rh, Math.min(cy, ry));

    const dx = cx - closestX;
    const dy = cy - closestY;
    const distSq = dx*dx + dy*dy;

    return distSq < (r * r);
  };

  // --- HTML5 CANVAS RENDER METHODS ---
  const renderGameFrame = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    map: GameMap
  ) => {
    // Save state
    ctx.save();

    // 1. Screen Shake shakes!
    if (screenShakeRef.current.duration > 0) {
      const shakeX = (Math.random() - 0.5) * screenShakeRef.current.intensity;
      const shakeY = (Math.random() - 0.5) * screenShakeRef.current.intensity;
      ctx.translate(shakeX, shakeY);
    }

    const camX = viewOffsetRef.current.x;
    const camY = viewOffsetRef.current.y;

    // Outer sky backgrounds
    if (map.theme === "outpost") {
      // Dynamic nightsky radial twilight
      const gradient = ctx.createRadialGradient(width/2, height/2, 20, width/2, height/2, width);
      gradient.addColorStop(0, "#0f172a"); // indigo shade slate
      gradient.addColorStop(1, "#020617"); // midnight obsidian
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Star constellations
      ctx.save();
      ctx.translate(-camX * 0.12, -camY * 0.12); // Parallax factor
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      for (let i = 0; i < 60; i++) {
        const sx = (i * 47) % 2400;
        const sy = (i * 83) % 1400;
        ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
      }
      ctx.restore();
    } else {
      // Dark caverns backgrounds
      ctx.fillStyle = "#0c0a09"; // Stone brown background
      ctx.fillRect(0, 0, width, height);

      // Parallax cavern tunnels outline
      ctx.save();
      ctx.translate(-camX * 0.15, -camY * 0.15);
      ctx.strokeStyle = "rgba(120, 53, 15, 0.08)";
      ctx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(400 + i * 300, 500, 250, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Offset camera coordinates for following rendering loops!
    ctx.translate(-camX, -camY);

    // 2. RENDER MAP BRICKS & PLATFORMS
    map.rects.forEach(rect => {
      ctx.save();
      if (rect.type === "solid") {
        ctx.fillStyle = rect.color || "#334155";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        // Brick borders/highlights
        ctx.strokeStyle = "rgba(15, 23, 42, 0.3)";
        ctx.lineWidth = 3;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        // Grass cap layers on Outpost top surfaces
        if (map.theme === "outpost" && rect.color === "#3f6212") {
          ctx.fillStyle = "#22c55e"; // Vivid bright grass
          ctx.fillRect(rect.x, rect.y, rect.width, 10);
        } else if (map.theme === "catacombs") {
          // Cave brick textures patterns
          ctx.strokeStyle = "rgba(120, 113, 108, 0.1)";
          ctx.lineWidth = 1;
          for (let tx = rect.x + 30; tx < rect.x + rect.width; tx += 45) {
            ctx.beginPath();
            ctx.moveTo(tx, rect.y);
            ctx.lineTo(tx, rect.y + rect.height);
            ctx.stroke();
          }
        }
      } else if (rect.type === "platform") {
        // Wood or steel walkway railings
        ctx.fillStyle = rect.color || "#94a3b8";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        
        ctx.fillStyle = "rgba(15, 23, 42, 0.2)";
        for (let j = rect.x + 10; j < rect.x + rect.width; j += 20) {
          ctx.fillRect(j, rect.y + 3, 5, rect.height - 6);
        }
      } else if (rect.type === "deadly") {
        // Lava glow gradients
        const lavaGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
        if (map.theme === "outpost") {
          lavaGrad.addColorStop(0, "#f97316"); // Molten liquid
          lavaGrad.addColorStop(1, "#7c2d12");
        } else {
          // Acid green
          lavaGrad.addColorStop(0, "#22c55e");
          lavaGrad.addColorStop(1, "#14532d");
        }
        ctx.fillStyle = lavaGrad;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        // Toxic/Lava bubble droplets animations
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        for (let i = 0; i < 15; i++) {
          const bx = rect.x + ((i * 123) % rect.width);
          const by = rect.y + 12 + ((Date.now() / 15 + i * 37) % (rect.height - 18));
          ctx.beginPath();
          ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });

    // 3. RENDER WEAPON DROPS LAYOUT ON FLOOR
    weaponDropsRef.current.forEach(drop => {
      // Only draw weapons fully spawned (cooldown timer is zero)
      if (drop.respawnTime === 0) {
        ctx.save();
        // Hover floating bobs effect
        const bobOffset = Math.sin(Date.now() / 200) * 4;
        ctx.translate(drop.x, drop.y + bobOffset);

        // Glow shell outlines
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
        ctx.beginPath();
        ctx.arc(0, -6, 14, 0, Math.PI * 2);
        ctx.fill();

        // Draw weapon shapes
        renderGunSprite(ctx, drop.type, 0.85);

        ctx.restore();
      }
    });

    // 4. RENDER FLYING BULLET TRAILS
    bulletsRef.current.forEach(b => {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = b.weaponType === WeaponType.Sniper ? "#06b6d4" : b.weaponType === WeaponType.RocketLauncher ? "#fb923c" : "#eab308";
      ctx.lineWidth = b.weaponType === WeaponType.Sniper ? 3 : b.isPellet ? 1.5 : 2;
      ctx.lineCap = "round";

      // Draw trail segment
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 1.5, b.y - b.vy * 1.5);
      ctx.stroke();

      // Rocket Bazooka custom visual capsule heads
      if (b.weaponType === WeaponType.RocketLauncher) {
        ctx.fillStyle = "#ea580c";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Rocket booster exhausts
        particlesRef.current.push({
          x: b.x - b.vx * 0.5,
          y: b.y - b.vy * 0.5,
          vx: -b.vx * 0.1 + (Math.random() - 0.5) * 1.2,
          vy: -b.vy * 0.1 + (Math.random() - 0.5) * 1.2,
          color: Math.random() < 0.6 ? "#f97316" : "#475569",
          size: Math.random() * 4 + 2,
          alpha: 0.8,
          life: 0,
          maxLife: 15,
          type: "smoke"
        });
      }
      ctx.restore();
    });

    // 5. RENDER ACTIVE BOUNCING GRENADES
    grenadesRef.current.forEach(g => {
      ctx.save();
      ctx.translate(g.x, g.y);
      
      // Blink red near explosion
      const isBlinking = Math.floor(g.timer / 100) % 2 === 0;

      ctx.fillStyle = isBlinking ? "#f43f5e" : "#1c1917";
      ctx.strokeStyle = "#4b5563";
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(0, 0, GRENADE_RADIUS, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();

      // Fuse elements
      ctx.beginPath();
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 2;
      ctx.moveTo(0, -GRENADE_RADIUS);
      ctx.lineTo(1, -GRENADE_RADIUS - 3);
      ctx.stroke();

      ctx.restore();
    });

    // 6. RENDER PARTICLES SYSTEMS (Smoke, Blood, Fire, Sparks)
    particlesRef.current.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 7. RENDER PLAYERS & ROBOT AVATARS (Local + Remotes)
    const renderPlayerAvatar = (p: Player) => {
      if (p.isDead) return;

      ctx.save();
      ctx.translate(p.x, p.y);

      // --- JETPACK exhaust visuals ---
      if (p.isJetpacking) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(p.isFacingLeft ? 10 : -10, 16 + Math.random() * 5, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(p.isFacingLeft ? 10 : -10, 12 + Math.random() * 3, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- AVATAR BASE BODIES ---
      ctx.save();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 3.5;

      // Draw custom backpack/jetpack thrusters behind body
      ctx.fillStyle = "#4b5563";
      ctx.fillRect(p.isFacingLeft ? 6 : -14, -8, 8, 22);
      ctx.strokeRect(p.isFacingLeft ? 6 : -14, -8, 8, 22);

      // Circular head-body blob
      ctx.fillStyle = p.avatar.primaryColor;
      ctx.beginPath();
      ctx.arc(0, -12, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw customized Helmet style designs!
      ctx.fillStyle = p.avatar.accentColor;
      const hStyle = p.avatar.headStyle;
      if (hStyle === "classic") {
        // Soldier band hat
        ctx.beginPath();
        ctx.arc(0, -16, 18, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
      } else if (hStyle === "helmet") {
        // Full iron helmet shroud with visor line
        ctx.beginPath();
        ctx.arc(0, -14, 18.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#1e293b";
        ctx.fillRect(p.isFacingLeft ? -19 : 1, -16, 18, 6);
      } else if (hStyle === "visor") {
        // Glowing neon goggles
        ctx.fillStyle = "#06b6d4";
        ctx.fillRect(p.isFacingLeft ? -18 : 2, -18, 16, 6);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.isFacingLeft ? -18 : 2, -18, 16, 6);
      } else if (hStyle === "beret") {
        // Red commando beret
        ctx.fillStyle = "#b91c1c";
        ctx.beginPath();
        ctx.ellipse(0, -25, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (hStyle === "crown") {
        // Golden crowns !
        ctx.fillStyle = "#eab308";
        ctx.beginPath();
        ctx.moveTo(-16, -26);
        ctx.lineTo(-12, -40);
        ctx.lineTo(-4, -31);
        ctx.lineTo(4, -40);
        ctx.lineTo(12, -31);
        ctx.lineTo(16, -40);
        ctx.lineTo(16, -26);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Facemasks/Eyes (Facing side directions indicators)
      ctx.fillStyle = "#000000";
      if (p.isFacingLeft) {
        ctx.beginPath();
        ctx.arc(-10, -11, 2.5, 0, Math.PI*2);
        ctx.arc(-3, -11, 2.5, 0, Math.PI*2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(3, -11, 2.5, 0, Math.PI*2);
        ctx.arc(10, -11, 2.5, 0, Math.PI*2);
        ctx.fill();
      }

      ctx.restore();

      // --- WEAPON RENDERING ON HAND ROTATIONS ---
      ctx.save();
      // Pivot hand relative to shoulders
      ctx.translate(0, -6);
      ctx.rotate(p.angle);

      const activeGun = p.weapons[p.equippedWeaponIndex]?.type || WeaponType.Pistol;
      const isFlipped = p.angle > Math.PI/2 || p.angle < -Math.PI/2;
      
      // Draw weapon sprite pointing exact aiming coordinates
      renderGunSprite(ctx, activeGun, 0.95, isFlipped);

      // Muzzle flash when shooting!
      if (p.isShooting && Math.random() < 0.25) {
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(28, -2, Math.random() * 5 + 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // --- SHIELD ARMS RENDERING (Fists bobbing) ---
      ctx.save();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.fillStyle = p.avatar.accentColor;

      const bobX = Math.sin(Date.now() / 150) * 2;
      // Draw side fist
      ctx.beginPath();
      ctx.arc(p.isFacingLeft ? -12 + bobX : 12 + bobX, 2, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // --- NAMEPLATES & VITAL HP OVERLAY HUDS ---
      ctx.save();
      ctx.textAlign = "center";
      
      // Name
      ctx.fillStyle = p.id === currentIdRef.current ? "#38bdf8" : "#f1f5f9";
      ctx.font = "bold 11px sans-serif";
      // Draw kills above name slightly
      const scoreTag = p.kills > 0 ? ` [${p.kills}]` : "";
      ctx.fillText(`${p.name}${scoreTag}`, 0, -48);

      // Simple tiny health bar hanging directly over head
      if (p.health < 100) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
        ctx.fillRect(-22, -42, 44, 4.5);
        ctx.fillStyle = p.health > 40 ? "#22c55e" : "#ef4444";
        ctx.fillRect(-22, -42, 44 * (p.health / 100), 4.5);
      }
      ctx.restore();

      // --- SPEECH BUBBLES ---
      const bubble = speechBubblesRef.current.get(p.id);
      if (bubble) {
        ctx.save();
        ctx.font = "bold 11px sans-serif";
        const bubbleTxtWidth = ctx.measureText(bubble.text).width;
        const bPadding = 8;
        const bW = bubbleTxtWidth + bPadding * 2;
        const bH = 22;

        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;

        // Bubble capsule
        ctx.fillRect(-bW/2, -84, bW, bH);
        ctx.strokeRect(-bW/2, -84, bW, bH);

        // tail arrow point
        ctx.beginPath();
        ctx.moveTo(-5, -62);
        ctx.lineTo(0, -56);
        ctx.lineTo(5, -62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.fillText(bubble.text, 0, -70);
        ctx.restore();
      }

      ctx.restore();
    };

    // Render local player circular body
    renderPlayerAvatar(localPlayerRef.current);

    // Render other multiplayer components
    remotePlayersRef.current.forEach(p => {
      renderPlayerAvatar(p);
    });

    // 8. RESTORE DECORATIONS SHAKES
    ctx.restore();
  };

  // Helper method for drawing pixel-based guns on the canvas
  const renderGunSprite = (
    ctx: CanvasRenderingContext2D,
    type: WeaponType,
    scale: number,
    isFlipped: boolean = false
  ) => {
    ctx.save();
    ctx.scale(scale, scale);

    // Apply flip reflection to make gun face left upright if aiming backwards
    if (isFlipped) {
      ctx.scale(1, -1);
    }

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;

    switch (type) {
      case WeaponType.Pistol: {
        // Desert Eagle
        ctx.fillStyle = "#64748b"; // metallic steel gray
        ctx.fillRect(0, -3, 14, 5); // barrel
        ctx.strokeRect(0, -3, 14, 5);
        ctx.fillRect(0, 1, 4, 6); // handle
        break;
      }
      case WeaponType.Rifle: {
        // Assault M4
        ctx.fillStyle = "#1e293b"; // Tactical black slate
        ctx.fillRect(-4, -4, 26, 5); // barrel
        ctx.strokeRect(-4, -4, 26, 5);
        ctx.fillStyle = "#94a3b8"; // Scope/grip highlights
        ctx.fillRect(4, -7, 6, 3); // optical sight
        ctx.fillStyle = "#475569";
        ctx.fillRect(-1, 1, 4, 6); // grip handle
        ctx.fillRect(10, 1, 3, 5); // Ammo clip loader
        break;
      }
      case WeaponType.Shotgun: {
        // Combat Pump
        ctx.fillStyle = "#334155";
        ctx.fillRect(-5, -4, 25, 4.5); // long barrel
        ctx.strokeRect(-5, -4, 25, 4.5);
        ctx.fillStyle = "#78350f"; // wooden brown grips or handle
        ctx.fillRect(3, -1, 10, 2.5); // holding pump
        ctx.fillRect(-7, 0, 4, 5); // Stock grip
        break;
      }
      case WeaponType.Sniper: {
        // Heavy sniper
        ctx.fillStyle = "#14532d"; // Camo dark green
        ctx.fillRect(-10, -4, 34, 4.5); // ultra long beam barrel
        ctx.strokeRect(-10, -4, 34, 4.5);
        ctx.fillStyle = "#dc2626"; // red lasers sight dots
        ctx.fillRect(12, 1, 1.5, 4.5);
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(-2, -7, 10, 3.5); // High power scopes
        ctx.strokeRect(-2, -7, 10, 3.5);
        ctx.fillRect(-14, -1, 6, 6); // stock body supports
        break;
      }
      case WeaponType.RocketLauncher: {
        // Bazooka canister RPG
        ctx.fillStyle = "#15803d"; // Army green canister
        ctx.fillRect(-8, -8, 28, 11); // heavy thick tube barrel
        ctx.strokeRect(-8, -8, 28, 11);
        ctx.fillStyle = "#b45309"; // wood heat wraps details
        ctx.fillRect(-2, -9, 8, 13);
        ctx.fillStyle = "#ea580c"; // orange warhead tip ready
        ctx.beginPath();
        ctx.moveTo(20, -8);
        ctx.lineTo(26, -2.5);
        ctx.lineTo(20, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  };

  // --- HUD CALCULATES ---
  const lp = localPlayerRef.current;
  const activeGunState = lp.weapons[lp.equippedWeaponIndex] || { type: WeaponType.Pistol, clipAmmo: 0, reserveAmmo: 0 };
  const currentGunStats = WEAPON_DEFAULTS[activeGunState.type];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans text-slate-100 select-none">
      
      {/* 1. INTERACTIVE SCREEN CANVAS STAGE */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block cursor-crosshair z-0"
      />

      {/* 2. LIVE HUD HUD OVERLAYS */}
      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 md:p-6 select-none leading-none">
        
        {/* TOP RAIL PANEL - HP GAUGE, AMMO FEED, AND MAP SELECTOR */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-4 w-full">
          
          {/* Top-Left: Avatar indicators, Health & Shield thrust bars */}
          <div className="flex items-center gap-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-md pointer-events-auto max-w-sm">
            <div className="relative w-12 h-12 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shrink-0">
              <svg className="w-9 h-9" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill={avatar.primaryColor} />
                <circle cx="20" cy="65" r="10" fill={avatar.accentColor} />
                <circle cx="80" cy="65" r="10" fill={avatar.accentColor} />
                {avatar.headStyle === "classic" && (
                  <path d="M 20 40 Q 50 10 80 40 Z" fill={avatar.accentColor} />
                )}
                {avatar.headStyle === "helmet" && (
                  <>
                    <circle cx="50" cy="45" r="32" fill={avatar.accentColor} />
                    <path d="M 35 48 H 65 V 55 H 35 Z" fill="#1e293b" />
                  </>
                )}
                {avatar.headStyle === "visor" && (
                  <path d="M 25 35 H 75 V 50 H 25 Z" fill="#06b6d4" />
                )}
                {avatar.headStyle === "beret" && (
                  <path d="M 18 42 C 16 25, 84 25, 82 42 Z" fill="#b91c1c" />
                )}
                {avatar.headStyle === "crown" && (
                  <path d="M 22 45 L 30 20 L 50 35 L 70 20 L 78 45 Z" fill="#fbbf24" />
                )}
                <ellipse cx="40" cy="55" rx="5" ry="3" fill="#000" />
                <ellipse cx="60" cy="55" rx="5" ry="3" fill="#000" />
              </svg>
            </div>

            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <div className="flex justify-between text-[11px] font-black tracking-wide uppercase text-slate-400 leading-none">
                <span className="truncate max-w-[90px]">{playerName}</span>
                <span className="text-emerald-400 font-mono">ROOM: {roomId}</span>
              </div>

              {/* Health bar Gauge */}
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-rose-500 fill-rose-500/10 shrink-0" />
                <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-3 overflow-hidden relative">
                  <div
                    style={{ width: `${hudHealth}%` }}
                    className="bg-gradient-to-r from-red-600 to-rose-500 h-full rounded-full transition-all duration-75"
                  />
                  <span className="absolute inset-0 text-[8px] font-black flex items-center justify-center text-white top-[1px]">HP</span>
                </div>
              </div>

              {/* Jetpack Booster Boots Energy Gauge */}
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10 shrink-0" />
                <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-3 overflow-hidden relative">
                  <div
                    style={{ width: `${hudFuel}%` }}
                    className="bg-gradient-to-r from-yellow-500 to-amber-500 h-full rounded-full transition-all duration-75"
                  />
                  <span className="absolute inset-0 text-[8px] font-black flex items-center justify-center text-white top-[1px]">BOOST</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top-Center: Live Kill-Feed Alerts notifications */}
          <div className="flex flex-col gap-1.5 max-h-24 overflow-hidden pointer-events-none md:ml-auto max-w-xs md:max-w-md w-full">
            {killFeed.map(evt => (
              <div
                key={evt.id}
                className="flex items-center gap-2 justify-end text-xs font-bold bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300 shadow-lg backdrop-blur-sm self-end"
              >
                <span className="text-sky-400">{evt.attackerName}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest px-1 bg-slate-950 rounded border border-slate-800">
                  {evt.weaponName}
                </span>
                <span className="text-rose-400">{evt.victimName}</span>
              </div>
            ))}
          </div>

          {/* Top-Right: Equiped Weapon details panel, map changer triggers */}
          <div className="flex flex-col gap-2 pointer-events-auto">
            {/* Weapon Details Card */}
            <div className="flex items-center gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-md">
              <div className="flex flex-col items-end">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                  {currentGunStats.name}
                </span>
                
                {activeGunState.isReloading ? (
                  <div className="flex items-center gap-1.5 text-cyan-400 font-black text-xs uppercase animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    RELOADING...
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black font-mono text-orange-400">
                      {activeGunState.clipAmmo}
                    </span>
                    <span className="text-sm font-semibold text-slate-400 font-mono">
                      / {activeGunState.reserveAmmo === Infinity ? "∞" : activeGunState.reserveAmmo}
                    </span>
                  </div>
                )}
              </div>

              {/* Weapon inventory swap selector buttons info */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    const event = new KeyboardEvent("keydown", { key: "q" });
                    window.dispatchEvent(event);
                  }}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-lg p-1.5 flex flex-col items-center justify-center transition-all cursor-pointer pointer-events-auto group"
                  title="Swap Weapon (Q)"
                >
                  <span className="text-[8px] font-black text-indigo-400 scale-[0.8] mb-0.5 uppercase tracking-wide group-hover:text-indigo-300">SWAP [Q]</span>
                  <div className="w-14 h-4 flex items-center justify-center">
                    <span className="text-[10px] font-extrabold text-slate-200 truncate max-w-[50px]">
                      {WEAPON_DEFAULTS[lp.weapons[(lp.equippedWeaponIndex + 1) % lp.weapons.length]?.type || WeaponType.Pistol].name}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Fragmentation grenades circle HUD, Map toggles */}
            <div className="flex gap-2 items-center justify-end">
              <div className="bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xl backdrop-blur-md">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">GRENADES [G]</span>
                <span className="px-2 py-0.5 bg-slate-950 text-emerald-400 font-black font-mono border border-slate-800 rounded-md text-xs">
                  {hudGrenades}
                </span>
              </div>

              {/* Map changer drop */}
              <div className="relative bg-slate-900/80 border border-slate-800 rounded-xl px-2.5 py-1 flex items-center gap-1.5 shadow-xl backdrop-blur-md pointer-events-auto">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <select
                  value={activeMapId}
                  onChange={(e) => handleMapChangeRequest(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-1 py-1"
                >
                  {MAPS.map(m => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200 select-none font-bold">
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM HUD RAIL - DISMISS CONTROLS AND CHAT SYSTEM */}
        <div className="flex items-end justify-between w-full gap-4">
          
          {/* Bottom-Left: Live chat panel logs history */}
          <div className="flex flex-col gap-2 max-w-sm w-full pointer-events-auto">
            {/* Chats log shell */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 h-32 overflow-y-auto flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-slate-800">
              {chatLog.length === 0 && (
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-600 mt-auto text-center">
                  Live Battle Comms Room
                </div>
              )}
              {chatLog.map(msg => (
                <div key={msg.id} className="text-[11px] leading-relaxed">
                  <span className={`${msg.senderName === "SYSTEM" ? "text-slate-500" : msg.senderName === playerName ? "text-indigo-400" : "text-sky-400"} font-bold mr-1`}>
                    {msg.senderName}:
                  </span>
                  <span className="text-slate-200 font-medium font-sans">{msg.text}</span>
                </div>
              ))}
            </div>

            {/* Chat entry box overlay */}
            <div className="flex gap-1.5 mt-0.5">
              <input
                type="text"
                maxLength={45}
                placeholder="Press ENTER to chat with players..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onClick={() => {
                  setChatOpen(true);
                  chatOpenRef.current = true;
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs font-semibold outline-none text-slate-100 placeholder:text-slate-600"
              />
              <button
                onClick={sendChatMessage}
                className="px-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white cursor-pointer active:scale-95 transition-all flex items-center justify-center p-2 border border-indigo-500"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Bottom-Right: Exit buttons */}
          <div className="pointer-events-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-2 rounded-xl text-[10px] text-slate-400 font-semibold shadow-lg backdrop-blur-md">
              <span>Developed by:</span>
              <span className="text-emerald-400 font-black tracking-wide uppercase">Subroto Kumar Barman</span>
            </div>
            <button
              onClick={onLeave}
              className="px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl text-rose-400 font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg backdrop-blur-md cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Leave Game Room
            </button>
          </div>

        </div>

      </div>

      {/* 3. PERSISTENT RETRO SCOREBOARD TAB OVERLAYS SHEET (Visible by holding TAB) */}
      {(showScoreboard || isDeadOverlayVisible(hudHealth)) && (
        <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center p-6 backdrop-blur-sm animate-fade-in pointer-events-none select-none">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl flex flex-col gap-6 pointer-events-auto">
            
            {/* Header score */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Award className="text-yellow-500 w-5 h-5 fill-yellow-500/10" />
                <h3 className="text-xl font-bold tracking-tight">Eta Online Scoreboard</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                Lobby: {roomId}
              </span>
            </div>

            {/* List of active players on room */}
            <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">
                <div className="col-span-6">Warrior Name</div>
                <div className="col-span-2 text-center text-emerald-400">Kills</div>
                <div className="col-span-2 text-center text-rose-400">Deaths</div>
                <div className="col-span-2 text-right text-sky-400">Ping (ms)</div>
              </div>

              {playerList
                .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
                .map(p => (
                  <div
                    key={p.id}
                    className={`grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      p.id === currentId
                        ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                        : "bg-slate-950 border-slate-800/60 text-slate-300"
                    }`}
                  >
                    <div className="col-span-6 flex items-center gap-2 overflow-hidden truncate">
                      {/* Colored circular dot */}
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.avatar.primaryColor }}
                      />
                      <span className="truncate">{p.name}</span>
                      {p.id === currentId && (
                        <span className="text-[8px] bg-indigo-500 text-white font-black px-1 py-0.2 rounded shrink-0">YOU</span>
                      )}
                    </div>
                    <div className="col-span-2 text-center font-mono font-black text-emerald-400 text-sm">
                      {p.kills}
                    </div>
                    <div className="col-span-2 text-center font-mono font-medium text-slate-400 text-sm">
                      {p.deaths}
                    </div>
                    <div className="col-span-2 text-right font-mono text-xs text-sky-400/80">
                      {p.ping === 15 && p.id !== currentId ? "..." : `${p.ping}ms`}
                    </div>
                  </div>
                ))}
            </div>

            {/* Dead indicators notices */}
            {hudHealth <= 0 && (
              <div className="flex flex-col items-center justify-center p-4 bg-rose-500/5 rounded-xl border border-rose-500/20 text-center text-slate-100 animate-pulse mt-1 gap-1">
                <div className="text-sm font-black text-rose-500 uppercase tracking-widest">
                  YOU WERE WASTED!
                </div>
                <div className="text-xs text-slate-400 leading-normal">
                  Spawning back into map in{" "}
                  <span className="text-rose-400 font-black font-mono">
                    {Math.max(0, Math.ceil(lp.respawnTimer))}s
                  </span>
                </div>
              </div>
            )}

            <div className="text-[10px] text-slate-500 font-medium text-center pb-1">
              Press and hold <span className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-slate-400 rounded">TAB</span> during the match to toggle this board overlay.
            </div>

          </div>
        </div>
      )}

      {/* 4. DISMISS CONNECTING INDICAOR OVERLAYS */}
      {connecting && (
        <div className="absolute inset-0 bg-slate-950 z-50 flex flex-col gap-4 items-center justify-center font-bold">
          <div className="relative flex items-center justify-center">
            <Radio className="w-10 h-10 text-sky-400 animate-pulse" />
            <span className="absolute animate-ping inline-flex h-8 w-8 rounded-full bg-sky-400 opacity-20" />
          </div>
          <div className="flex flex-col gap-1 items-center">
            <span className="text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-sky-300 font-black tracking-wide uppercase">
              Establishing Battle Session
            </span>
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Authenticating with Port 3000 Node Container...
            </span>
          </div>
        </div>
      )}

    </div>
  );
}

// Helper checking to reveal deceased scoreboard cards immediately on defeat
function isDeadOverlayVisible(hp: number) {
  return hp <= 0;
}
