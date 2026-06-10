/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameMap, WeaponType } from "./types";

export const MAPS: GameMap[] = [
  {
    id: "outpost",
    name: "The Outpost (Sky High)",
    width: 2200,
    height: 1200,
    gravity: 0.35,
    theme: "outpost",
    rects: [
      // Left Outpost Base Tower
      { x: 100, y: 700, width: 350, height: 400, type: "solid", color: "#334155" }, // Steel wall dark slate
      { x: 100, y: 670, width: 350, height: 30, type: "solid", color: "#475569" }, // Concrete top
      { x: 150, y: 520, width: 250, height: 30, type: "platform", color: "#94a3b8" }, // Upper steel bridge

      // Left floating island
      { x: 550, y: 420, width: 250, height: 40, type: "solid", color: "#3f6212" }, // Forest grass island top
      { x: 570, y: 460, width: 210, height: 80, type: "solid", color: "#78350f" }, // Dirt bottom

      // Central Command Sky Tower (Multi-level platform)
      { x: 950, y: 800, width: 300, height: 300, type: "solid", color: "#1e293b" }, // Heavy block bottom
      { x: 900, y: 770, width: 400, height: 30, type: "solid", color: "#64748b" }, // Concrete ledge
      { x: 980, y: 580, width: 240, height: 25, type: "platform", color: "#cbd5e1" }, // Intermediate metal platform 1
      { x: 900, y: 440, width: 400, height: 25, type: "platform", color: "#94a3b8" }, // Outer metal platform 2
      { x: 1020, y: 280, width: 160, height: 30, type: "solid", color: "#1e293b" }, // Overlook high observation desk
      { x: 950, y: 250, width: 300, height: 30, type: "platform", color: "#ef4444" }, // Top tactical red laser deck

      // Right floating island
      { x: 1400, y: 420, width: 250, height: 40, type: "solid", color: "#3f6212" }, 
      { x: 1420, y: 460, width: 210, height: 80, type: "solid", color: "#78350f" },

      // Right Outpost Launcher Complex
      { x: 1750, y: 700, width: 350, height: 400, type: "solid", color: "#334155" }, 
      { x: 1750, y: 670, width: 350, height: 30, type: "solid", color: "#475569" },
      { x: 1800, y: 520, width: 250, height: 30, type: "platform", color: "#94a3b8" },

      // Bottom pits & bridge connections
      { x: 100, y: 1100, width: 2000, height: 100, type: "deadly", color: "#f97316", label: "LAVA ZONE" }, // Deadly molten center lava!

      // Safe ground zones next to walls
      { x: 50, y: 1050, width: 400, height: 50, type: "solid", color: "#1e293b" }, // Safe spawn pad left
      { x: 1750, y: 1050, width: 400, height: 50, type: "solid", color: "#1e293b" }, // Safe spawn pad right

      // Floating support bridges
      { x: 740, y: 920, width: 140, height: 20, type: "platform", color: "#64748b" },
      { x: 1320, y: 920, width: 140, height: 20, type: "platform", color: "#64748b" },
    ],
    spawnPoints: [
      // Player Spawns (Safe points above ground)
      { x: 150, y: 950, type: "player" },
      { x: 300, y: 600, type: "player" },
      { x: 670, y: 350, type: "player" },
      { x: 1100, y: 200, type: "player" },
      { x: 1100, y: 700, type: "player" },
      { x: 1520, y: 350, type: "player" },
      { x: 1900, y: 600, type: "player" },
      { x: 2000, y: 950, type: "player" },

      // Weapon Spawns
      { x: 275, y: 640, type: "weapon", weaponType: WeaponType.Sniper }, // Left Sniper spot
      { x: 670, y: 390, type: "weapon", weaponType: WeaponType.Rifle }, // Left Floating platform Rifle
      { x: 1100, y: 220, type: "weapon", weaponType: WeaponType.RocketLauncher }, // Center observation tower high Rocket Launcher
      { x: 1100, y: 410, type: "weapon", weaponType: WeaponType.Shotgun }, // Mid-tier platform Shotgun
      { x: 1525, y: 390, type: "weapon", weaponType: WeaponType.Rifle }, // Right Floating platform Rifle
      { x: 1925, y: 640, type: "weapon", weaponType: WeaponType.Sniper }, // Right tower spot sniper
      { x: 200, y: 1020, type: "weapon", weaponType: WeaponType.Shotgun }, // Ground backup spot
      { x: 2000, y: 1020, type: "weapon", weaponType: WeaponType.Rifle } // Ground backup spot
    ]
  },
  {
    id: "catacombs",
    name: "The Catacombs (Cavern Labyrinth)",
    width: 1800,
    height: 1200,
    gravity: 0.32,
    theme: "catacombs",
    rects: [
      // Outer perimeter borders
      { x: 0, y: 0, width: 40, height: 1200, type: "solid", color: "#451a03" }, // Left boundary cliff wall
      { x: 1760, y: 0, width: 40, height: 1200, type: "solid", color: "#451a03" }, // Right boundary cliff wall
      { x: 0, y: 0, width: 1800, height: 40, type: "solid", color: "#451a03" }, // Roof ceiling

      // Central Column - Partitioning the battlefield
      { x: 800, y: 40, width: 200, height: 260, type: "solid", color: "#292524" }, // Large ceiling drop block
      { x: 800, y: 550, width: 200, height: 260, type: "solid", color: "#292524" }, // Large floating center divider
      { x: 650, y: 650, width: 500, height: 40, type: "solid", color: "#1c1917" }, // Cross platform

      // Upper Chambers
      { x: 40, y: 350, width: 350, height: 40, type: "solid", color: "#44403c" }, // Left high wall shelf
      { x: 1410, y: 350, width: 350, height: 40, type: "solid", color: "#44403c" }, // Right high wall shelf

      // Lower Level Tunnels
      { x: 40, y: 850, width: 450, height: 40, type: "solid", color: "#44403c" }, // Left tunnel ceiling
      { x: 1310, y: 850, width: 450, height: 40, type: "solid", color: "#44403c" }, // Right tunnel ceiling
      { x: 40, y: 1100, width: 500, height: 100, type: "solid", color: "#1c1917" }, // Bottom floor left
      { x: 1260, y: 1100, width: 500, height: 100, type: "solid", color: "#1c1917" }, // Bottom floor right

      // Bottom toxic acid pits
      { x: 540, y: 1140, width: 720, height: 60, type: "deadly", color: "#22c55e", label: "TOXIC POOL" }, // Acid center

      // Mid-level support bridges (permeable wooden platforms)
      { x: 420, y: 480, width: 250, height: 20, type: "platform", color: "#b45309" }, // Left wood platform
      { x: 1130, y: 480, width: 250, height: 20, type: "platform", color: "#b45309" }, // Right wood platform
      { x: 150, y: 650, width: 200, height: 20, type: "platform", color: "#b45309" }, // Left low shelf walkway
      { x: 1450, y: 650, width: 200, height: 20, type: "platform", color: "#b45309" }, // Right low shelf walkway

      // Small vertical columns/shelves
      { x: 450, y: 200, width: 40, height: 180, type: "solid", color: "#292524" },
      { x: 1310, y: 200, width: 40, height: 180, type: "solid", color: "#292524" },
    ],
    spawnPoints: [
      { x: 150, y: 200, type: "player" },
      { x: 250, y: 550, type: "player" },
      { x: 250, y: 1000, type: "player" },
      { x: 900, y: 450, type: "player" },
      { x: 1650, y: 200, type: "player" },
      { x: 1550, y: 550, type: "player" },
      { x: 1550, y: 1000, type: "player" },
      { x: 900, y: 950, type: "player" },

      // Cavern Weapon Drops
      { x: 150, y: 310, type: "weapon", weaponType: WeaponType.Sniper }, // High left Sniper spot
      { x: 1650, y: 310, type: "weapon", weaponType: WeaponType.Sniper }, // High right Sniper spot
      { x: 900, y: 480, type: "weapon", weaponType: WeaponType.RocketLauncher }, // Center spot Rocket Launcher
      { x: 550, y: 450, type: "weapon", weaponType: WeaponType.Rifle }, // Left mid-walkway Rifle
      { x: 1250, y: 450, type: "weapon", weaponType: WeaponType.Rifle }, // Right mid-walkway Rifle
      { x: 900, y: 610, type: "weapon", weaponType: WeaponType.Shotgun }, // Mid-bridge shotgun
      { x: 200, y: 810, type: "weapon", weaponType: WeaponType.Rifle }, // Bottom left tunnel entry rifle
      { x: 1600, y: 810, type: "weapon", weaponType: WeaponType.Shotgun } // Bottom right tunnel entry shotgun
    ]
  }
];

export function getMapById(id: string): GameMap {
  const map = MAPS.find(m => m.id === id);
  return map || MAPS[0];
}
