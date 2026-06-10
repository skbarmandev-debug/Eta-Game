/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createHttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { Player, WeaponDrop, WeaponType, Bullet, Grenade } from "./src/types";
import { getMapById, MAPS } from "./src/maps";

// Helper for ESModules in server.ts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GameRoom {
  id: string;
  mapId: string;
  players: Map<string, Player & { socket: WebSocket }>;
  weaponDrops: WeaponDrop[];
  bullets: Bullet[];
  grenades: Grenade[];
}

const rooms = new Map<string, GameRoom>();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createHttpServer(app);

  // In-memory API routes for monitoring or matchmaking
  app.get("/api/rooms", (req, res) => {
    const list = Array.from(rooms.values()).map(r => ({
      id: r.id,
      mapId: r.mapId,
      playerCount: r.players.size,
      players: Array.from(r.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        kills: p.kills,
        deaths: p.deaths
      }))
    }));
    res.json(list);
  });

  // Attach WebSocket server on the same HTTP port
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws: WebSocket) => {
    let currentPlayerId: string | null = null;
    let currentRoomId: string | null = null;

    // Send a system ping every 10 seconds to keep connection alive
    const keepAliveInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", data: { timestamp: Date.now() } }));
      }
    }, 10000);

    ws.on("message", (msgStr: string) => {
      try {
        const message = JSON.parse(msgStr);
        const { type, data } = message;

        switch (type) {
          case "pong": {
            // Client replied to our ping
            if (currentRoomId && currentPlayerId) {
              const room = rooms.get(currentRoomId);
              if (room) {
                const player = room.players.get(currentPlayerId);
                if (player) {
                  player.ping = Math.min(999, Date.now() - data.timestamp);
                }
              }
            }
            break;
          }

          case "join": {
            const { roomId, playerName, avatar } = data;
            currentRoomId = roomId || "lobby";
            currentPlayerId = Math.random().toString(36).substring(2, 9);

            // Fetch or create room
            let room = rooms.get(currentRoomId);
            if (!room) {
              const defaultMapId = "outpost";
              const mapData = getMapById(defaultMapId);
              
              // Seed custom weapon drops from map spawn points
              const initialDrops: WeaponDrop[] = mapData.spawnPoints
                .filter(sp => sp.type === "weapon")
                .map((sp, idx) => ({
                  id: `drop_${idx}_${Math.random().toString(36).substring(2, 5)}`,
                  type: sp.weaponType || WeaponType.Rifle,
                  x: sp.x,
                  y: sp.y,
                  spawnPointIndex: idx,
                  respawnTime: 0
                }));

              room = {
                id: currentRoomId,
                mapId: defaultMapId,
                players: new Map(),
                weaponDrops: initialDrops,
                bullets: [],
                grenades: []
              };
              rooms.set(currentRoomId, room);
            }

            // Create customizable Player profile
            const mapData = getMapById(room.mapId);
            const playerSpawnPoints = mapData.spawnPoints.filter(sp => sp.type === "player");
            const randomSpawn = playerSpawnPoints[Math.floor(Math.random() * playerSpawnPoints.length)] || { x: 400, y: 400 };

            const newPlayer: Player = {
              id: currentPlayerId!,
              name: playerName || `Recruit_${Math.floor(Math.random() * 900) + 100}`,
              avatar: avatar || {
                headStyle: "classic",
                primaryColor: "#22c55e",
                accentColor: "#ef4444"
              },
              x: randomSpawn.x,
              y: randomSpawn.y,
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
            };

            // Associate WebSocket reference
            room.players.set(currentPlayerId!, { ...newPlayer, socket: ws });

            // 1. Send initialization configuration to the connected individual
            const responsePlayers = Array.from(room.players.values()).map(p => {
              const { socket, ...rest } = p;
              return rest;
            });

            ws.send(JSON.stringify({
              type: "init",
              data: {
                id: currentPlayerId,
                players: responsePlayers,
                weaponDrops: room.weaponDrops,
                mapId: room.mapId
              }
            }));

            // 2. Broadcast and announce player arrival to everyone else in this room
            const announceMsg = JSON.stringify({
              type: "player_joined",
              data: { player: newPlayer }
            });
            for (const [id, p] of room.players) {
              if (id !== currentPlayerId && p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(announceMsg);
              }
            }
            break;
          }

          case "player_update": {
            if (!currentRoomId || !currentPlayerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            const player = room.players.get(currentPlayerId);
            if (player) {
              // Update state values from client ticks
              player.x = data.x;
              player.y = data.y;
              player.vx = data.vx;
              player.vy = data.vy;
              player.angle = data.angle;
              player.isFacingLeft = data.isFacingLeft;
              player.health = data.health;
              player.jetpackFuel = data.jetpackFuel;
              player.isDead = data.isDead;
              player.respawnTimer = data.respawnTimer || 0;
              player.equippedWeaponIndex = data.equippedWeaponIndex ?? 0;
              player.isJetpacking = data.isJetpacking ?? false;
              player.isShooting = data.isShooting ?? false;
              player.lastActiveTime = Date.now();

              if (data.weapons) {
                player.weapons = data.weapons;
              }
              if (data.grenadeCount !== undefined) {
                player.grenadeCount = data.grenadeCount;
              }
            }
            break;
          }

          case "fire_bullet": {
            if (!currentRoomId || !currentPlayerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            // Broadcast shooting bullet to all peers in room
            const fireMsg = JSON.stringify({
              type: "fire_bullet",
              data: { bullet: data.bullet }
            });
            for (const [id, p] of room.players) {
              if (id !== currentPlayerId && p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(fireMsg);
              }
            }
            break;
          }

          case "spawn_grenade": {
            if (!currentRoomId || !currentPlayerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            // Broadcast grenade throw
            const gMsg = JSON.stringify({
              type: "spawn_grenade",
              data: { grenade: data.grenade }
            });
            for (const [id, p] of room.players) {
              if (id !== currentPlayerId && p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(gMsg);
              }
            }
            break;
          }

          case "explosion": {
            if (!currentRoomId || !currentPlayerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            // Broadcast splash blast
            const explMsg = JSON.stringify({
              type: "explosion",
              data: { x: data.x, y: data.y, dmgRadius: data.dmgRadius, type: data.type }
            });
            for (const [id, p] of room.players) {
              if (id !== currentPlayerId && p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(explMsg);
              }
            }
            break;
          }

          case "blood_spill": {
            if (!currentRoomId || !currentPlayerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            // Broadcast blood paint splatter
            const spillMsg = JSON.stringify({
              type: "blood_spill",
              data: { x: data.x, y: data.y, count: data.count, dirX: data.dirX, dirY: data.dirY }
            });
            for (const [id, p] of room.players) {
              if (id !== currentPlayerId && p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(spillMsg);
              }
            }
            break;
          }

          case "player_damaged": {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            const targetPlayer = room.players.get(data.targetId);
            if (targetPlayer) {
              targetPlayer.health = Math.max(0, targetPlayer.health - data.damage);
              
              // Broadcast hit registration
              const damageMsg = JSON.stringify({
                type: "player_damaged",
                data: { targetId: data.targetId, damage: data.damage, attackerId: data.attackerId }
              });
              for (const [_, p] of room.players) {
                if (p.socket.readyState === WebSocket.OPEN) {
                  p.socket.send(damageMsg);
                }
              }
            }
            break;
          }

          case "player_died": {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            const victim = room.players.get(data.victimId);
            const attacker = room.players.get(data.attackerId);

            if (victim) {
              victim.isDead = true;
              victim.deaths += 1;
              victim.health = 0;
            }
            if (attacker && data.victimId !== data.attackerId) {
              attacker.kills += 1;
            }

            // Broadcast kill feed announcement
            const deathMsg = JSON.stringify({
              type: "player_died",
              data: {
                victimId: data.victimId,
                attackerId: data.attackerId,
                weaponName: data.weaponName
              }
            });
            for (const [_, p] of room.players) {
              if (p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(deathMsg);
              }
            }
            break;
          }

          case "pickup_weapon": {
            if (!currentRoomId || !currentPlayerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            const drop = room.weaponDrops.find(d => d.id === data.dropId);
            const taker = room.players.get(currentPlayerId);

            // Verify drop remains active on ground before conceding pickup
            if (drop && drop.respawnTime === 0 && taker) {
              // Mark taken, start respawn cooldown trigger (15 seconds)
              drop.respawnTime = Date.now() + 15000;

              // Give custom replacement drop if player swapping existing ground slots (secondary vs primary)
              let oldWeaponDrop: WeaponDrop | undefined = undefined;
              if (data.replacedWeaponType) {
                // Return dropped weapon back to battlefield drops
                oldWeaponDrop = {
                  id: `drop_${Math.random().toString(36).substring(2, 7)}`,
                  type: data.replacedWeaponType,
                  x: taker.x,
                  y: taker.y,
                  ammoInClip: data.replacedWeaponClip,
                  ammoInReserve: data.replacedWeaponReserve,
                  spawnPointIndex: -1, // Spawned dynamically on ground
                  respawnTime: 0
                };
                room.weaponDrops.push(oldWeaponDrop);
              }

              // Broadcast accepted pickup to all clients in room
              const pickupMsg = JSON.stringify({
                type: "pickup_weapon",
                data: {
                  playerId: currentPlayerId,
                  dropId: drop.id,
                  equippedIndex: data.equippedIndex,
                  newWeaponType: drop.type,
                  oldWeaponDrop
                }
              });

              for (const [_, p] of room.players) {
                if (p.socket.readyState === WebSocket.OPEN) {
                  p.socket.send(pickupMsg);
                }
              }
            }
            break;
          }

          case "chat": {
            if (!currentRoomId || !currentPlayerId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            const player = room.players.get(currentPlayerId);
            if (player) {
              const chatMsg = JSON.stringify({
                type: "chat",
                data: {
                  senderId: currentPlayerId,
                  senderName: player.name,
                  text: data.text
                }
              });
              for (const [_, p] of room.players) {
                if (p.socket.readyState === WebSocket.OPEN) {
                  p.socket.send(chatMsg);
                }
              }
            }
            break;
          }

          case "change_map": {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            const mapId = data.mapId;
            const mapData = getMapById(mapId);
            if (mapData) {
              room.mapId = mapId;
              
              // Seed new map's weapons
              room.weaponDrops = mapData.spawnPoints
                .filter(sp => sp.type === "weapon")
                .map((sp, idx) => ({
                  id: `drop_${idx}_${Math.random().toString(36).substring(2, 5)}`,
                  type: sp.weaponType || WeaponType.Rifle,
                  x: sp.x,
                  y: sp.y,
                  spawnPointIndex: idx,
                  respawnTime: 0
                }));

              // Wipe out room entities
              room.bullets = [];
              room.grenades = [];

              // Teleport everyone to random points
              const pSpawnPoints = mapData.spawnPoints.filter(sp => sp.type === "player");
              
              for (const [_, p] of room.players) {
                const sp = pSpawnPoints[Math.floor(Math.random() * pSpawnPoints.length)] || { x: 400, y: 400 };
                p.x = sp.x;
                p.y = sp.y;
                p.vx = 0;
                p.vy = 0;
                p.health = 100;
                p.isDead = false;
                p.respawnTimer = 0;
                
                // Refresh map configuration & player arrays inside clients
                const listPlayers = Array.from(room.players.values()).map(pl => {
                  const { socket, ...rest } = pl;
                  return rest;
                });

                p.socket.send(JSON.stringify({
                  type: "init",
                  data: {
                    id: p.id,
                    players: listPlayers,
                    weaponDrops: room.weaponDrops,
                    mapId: room.mapId
                  }
                }));
              }
            }
            break;
          }
        }
      } catch (err) {
        console.error("Error processing websocket message:", err);
      }
    });

    ws.on("close", () => {
      clearInterval(keepAliveInterval);
      if (currentRoomId && currentPlayerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          room.players.delete(currentPlayerId);

          // If room is entirely empty, clean up after 1 minute of inactivity
          if (room.players.size === 0) {
            setTimeout(() => {
              const checkRoom = rooms.get(currentRoomId!);
              if (checkRoom && checkRoom.players.size === 0) {
                rooms.delete(currentRoomId!);
                console.log(`Cleaned up empty room ${currentRoomId}`);
              }
            }, 60000);
          } else {
            // Broadcast subtraction of player
            const leaveMsg = JSON.stringify({
              type: "player_left",
              data: { id: currentPlayerId }
            });
            for (const [_, p] of room.players) {
              if (p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(leaveMsg);
              }
            }
          }
        }
      }
    });

    ws.on("error", (e) => {
      console.error("WebSocket Client Error:", e);
    });
  });

  // Server High frequency synchronization tick (runs at 30Hz / ~33ms intervals)
  setInterval(() => {
    for (const [roomId, room] of rooms) {
      if (room.players.size === 0) continue;

      // Handle weapon drops respawn timer
      const now = Date.now();
      let updatedDrops = false;
      room.weaponDrops.forEach(drop => {
        if (drop.respawnTime && drop.respawnTime > 0 && now > drop.respawnTime) {
          drop.respawnTime = 0;
          updatedDrops = true;
        }
      });

      // Keep only recent dynamic drops (e.g. dropped manually on death) that have spawnPointIndex === -1
      // Clean old manual drops to prevent lag issues
      const oldDropsCount = room.weaponDrops.length;
      room.weaponDrops = room.weaponDrops.filter(drop => {
        if (drop.spawnPointIndex === -1 && drop.respawnTime && now > drop.respawnTime) {
          // expire dynamic drops
          return false;
        }
        return true;
      });
      if (room.weaponDrops.length !== oldDropsCount) {
        updatedDrops = true;
      }

      // Convert players mapped array to list omitting active sockets
      const playersList = Array.from(room.players.values()).map(p => {
        const { socket, ...rest } = p;
        return rest;
      });

      const tickMsg = JSON.stringify({
        type: "tick",
        data: {
          players: playersList,
          weaponDrops: room.weaponDrops,
          activeBullets: [], // Managed and drawn locally client-side to minimize lag
          activeGrenades: []
        }
      });

      for (const [_, p] of room.players) {
        if (p.socket.readyState === WebSocket.OPEN) {
          p.socket.send(tickMsg);
        }
      }
    }
  }, 33);

  // Serve static assets / build index.html in production vs dev Vite setup
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bound listening on 0.0.0.0
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical server startup crash:", err);
});
