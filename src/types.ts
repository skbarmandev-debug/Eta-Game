/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Weapon definitions
export enum WeaponType {
  Pistol = "Pistol",
  Rifle = "Rifle",
  Shotgun = "Shotgun",
  Sniper = "Sniper",
  RocketLauncher = "RocketLauncher"
}

export interface WeaponStats {
  type: WeaponType;
  name: string;
  damage: number;
  fireRate: number; // millisecond delay between shots
  clipSize: number;
  reloadTime: number; // milliseconds
  speed: number; // bullet speed
  spread: number;
  ammoCap: number;
}

export const WEAPON_DEFAULTS: Record<WeaponType, WeaponStats> = {
  [WeaponType.Pistol]: {
    type: WeaponType.Pistol,
    name: "Desert Eagle",
    damage: 18,
    fireRate: 350,
    clipSize: 7,
    reloadTime: 1000,
    speed: 15,
    spread: 0.02,
    ammoCap: Infinity
  },
  [WeaponType.Rifle]: {
    type: WeaponType.Rifle,
    name: "M416",
    damage: 14,
    fireRate: 110,
    clipSize: 30,
    reloadTime: 1800,
    speed: 18,
    spread: 0.05,
    ammoCap: 150
  },
  [WeaponType.Shotgun]: {
    type: WeaponType.Shotgun,
    name: "SPAS-12",
    damage: 12, // per pellet (fires 5 pellets)
    fireRate: 800,
    clipSize: 5,
    reloadTime: 2200,
    speed: 12,
    spread: 0.22,
    ammoCap: 25
  },
  [WeaponType.Sniper]: {
    type: WeaponType.Sniper,
    name: "AWM",
    damage: 65,
    fireRate: 1500,
    clipSize: 3,
    reloadTime: 2500,
    speed: 28,
    spread: 0,
    ammoCap: 10
  },
  [WeaponType.RocketLauncher]: {
    type: WeaponType.RocketLauncher,
    name: "RPG-7",
    damage: 80, // High direct damage + splash
    fireRate: 2000,
    clipSize: 1,
    reloadTime: 3000,
    speed: 8,
    spread: 0.01,
    ammoCap: 3
  }
};

// Player structure
export interface AvatarConfig {
  headStyle: "classic" | "helmet" | "visor" | "beret" | "crown";
  primaryColor: string; // hex
  accentColor: string; // hex
}

export interface Player {
  id: string;
  name: string;
  avatar: AvatarConfig;
  
  // Physics & Mechanics
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // Aim angle in radians
  isFacingLeft: boolean;
  
  // Game states
  health: number;
  jetpackFuel: number; // 0 to 100
  isDead: boolean;
  respawnTimer: number; // in seconds
  
  // Weapon/Inventory
  equippedWeaponIndex: number;
  weapons: {
    type: WeaponType;
    clipAmmo: number;
    reserveAmmo: number;
    isReloading: boolean;
    reloadProgress: number; // 0 to 1
  }[];
  grenadeCount: number;
  
  // Live score tracker
  kills: number;
  deaths: number;
  ping: number;
  
  // Active dynamic visual fields
  isJetpacking: boolean;
  isShooting: boolean;
  lastActiveTime: number;
}

// Bullets
export interface Bullet {
  id: string;
  senderId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  weaponType: WeaponType;
  damage: number;
  createdAt: number;
  isPellet?: boolean; // For shotgun scatter
}

// Grenade
export interface Grenade {
  id: string;
  senderId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number; // remaining duration in ms
}

// Weapon Drop on ground
export interface WeaponDrop {
  id: string;
  type: WeaponType;
  x: number;
  y: number;
  ammoInClip?: number;
  ammoInReserve?: number;
  respawnTime?: number; // timestamp if taken and waiting to respawn
  spawnPointIndex: number; 
}

// Map physics elements
export interface MapLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: "solid" | "platform" | "deadly"; // deadly = lava
}

export interface MapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "solid" | "platform" | "deadly" | "healing";
  color?: string;
  label?: string;
}

export interface MapSpawnPoint {
  x: number;
  y: number;
  type: "player" | "weapon";
  weaponType?: WeaponType;
}

export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  rects: MapRect[];
  spawnPoints: MapSpawnPoint[];
  gravity: number;
  theme: "outpost" | "catacombs";
}

// WebSocket Event Names/Structures
export type WsMessage =
  | { type: "init"; data: { id: string; players: Player[]; weaponDrops: WeaponDrop[]; mapId: string } }
  | { type: "player_joined"; data: { player: Player } }
  | { type: "player_left"; data: { id: string } }
  | { type: "tick"; data: { players: Player[]; weaponDrops: WeaponDrop[]; activeBullets: Bullet[]; activeGrenades: Grenade[] } }
  | { type: "fire_bullet"; data: { bullet: Bullet } }
  | { type: "spawn_grenade"; data: { grenade: Grenade } }
  | { type: "explosion"; data: { x: number; y: number; dmgRadius: number; type: "rocket" | "grenade" } }
  | { type: "blood_spill"; data: { x: number; y: number; count: number; dirX: number; dirY: number } }
  | { type: "player_damaged"; data: { targetId: string; damage: number; attackerId: string } }
  | { type: "player_died"; data: { victimId: string; attackerId: string; weaponName: string } }
  | { type: "chat"; data: { senderId: string; senderName: string; text: string } }
  | { type: "pickup_weapon"; data: { playerId: string; dropId: string; equippedIndex: number; newWeaponType: WeaponType; oldWeaponDrop?: WeaponDrop } }
  | { type: "ping"; data: { timestamp: number } }
  | { type: "pong"; data: { timestamp: number } };
