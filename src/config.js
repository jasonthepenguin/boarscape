// =============================================================================
// World
// =============================================================================
export const FIELD_SIZE = 120;
export const TREE_COUNT = 500;
export const SPAWN_AVOID_RADIUS = 16;
export const GROUND_Y = 0;

// =============================================================================
// Player
// =============================================================================
export const PLAYER_DESIRED_HEIGHT = 2.1;
export const WALK_SPEED = 4.6;
export const RUN_SPEED = 7.4;
export const JUMP_SPEED = 7.2;
export const GRAVITY = 18.5;
export const ROTATION_SPEED = 14;

// =============================================================================
// Camera
// =============================================================================
export const CAMERA_FOV = 60;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 2000;
export const CAMERA_DISTANCE = 8.5;
export const CAMERA_MIN_DISTANCE = 3.6;
export const CAMERA_MAX_DISTANCE = 18.0;
export const CAMERA_DEFAULT_PHI = 1.12;
export const CAMERA_MIN_PHI = 0.55;
export const CAMERA_MAX_PHI = 1.45;
export const CAMERA_SMOOTH = 14;
export const CAMERA_ROTATE_SPEED = 0.0042;

// =============================================================================
// Scene
// =============================================================================
export const BG_COLOR = "#87cfff";
export const MAX_DT = 0.05;
export const TONE_MAPPING_EXPOSURE = 1.22;

// =============================================================================
// Lighting
// =============================================================================
export const HEMI_SKY_COLOR = 0xbfe3ff;
export const HEMI_GROUND_COLOR = 0x264a1a;
export const HEMI_INTENSITY = 1.15;
export const AMBIENT_INTENSITY = 0.75;
export const SUN_INTENSITY = 1.35;
export const SUN_POSITION = [40, 65, 35];
export const SUN_SHADOW_BIAS = -0.0002;
export const SUN_SHADOW_NORMAL_BIAS = 0.015;
export const SHADOW_MAP_SIZE = 2048;
export const SHADOW_NEAR = 1;
export const SHADOW_FAR = 220;
export const SHADOW_RANGE = 90;
export const FILL_INTENSITY = 0.25;
export const FILL_POSITION = [-55, 28, -65];

// =============================================================================
// Tree distribution
// =============================================================================
export const PINE_RATIO = 0.4;
export const ROUND_RATIO = 0.35;
export const BIRCH_RATIO = 0.25;

// =============================================================================
// Color palettes
// =============================================================================
export const TRUNK_COLORS = ["#5c3d2e", "#7b4a2a", "#6b5344", "#4a3728", "#8b6914"];
export const LEAF_COLORS = ["#2f8f3a", "#1e6b2e", "#4a9f4a", "#3d7a3d", "#5aaf5a", "#2d5a1e", "#6b8e23"];
export const BIRCH_TRUNK_COLORS = ["#d4c8b8", "#e8dcc8", "#c9b99a", "#bfb5a0"];
export const BIRCH_LEAF_COLORS = ["#8bc34a", "#9ccc65", "#7cb342", "#aed581"];

// =============================================================================
// NPCs
// =============================================================================
export const NPC_COUNT = 8;
export const NPC_WALK_SPEED = 2.5;

// =============================================================================
// Boar color presets
// =============================================================================
// =============================================================================
// Attack / Phone throw
// =============================================================================
export const ATTACK_COOLDOWN = 2.0;
export const ATTACK_RANGE = 8;
export const PHONE_FLIGHT_TIME = 0.5;
export const PHONE_ARC_HEIGHT = 3.0;
export const PHONE_WIDTH = 0.08;
export const PHONE_HEIGHT = 0.16;
export const PHONE_DEPTH = 0.01;
export const NPC_MAX_ADDICTION = 3;
export const NPC_DEATH_ANIM_DURATION = 2.0;
export const NPC_DESPAWN_DELAY = 15.0;
export const NPC_RESPAWN_DELAY = 10.0;
export const SELECTION_RING_RADIUS = 0.5;
export const SELECTION_RING_TUBE = 0.03;
export const ACTION_BAR_SLOTS = 5;

// =============================================================================
// Net / Swoop (slot 2)
// =============================================================================
export const NET_RANGE = 5;
export const NET_COOLDOWN = 3.0;
export const SWOOP_DURATION = 1.2;
export const SWOOP_LIFT_HEIGHT = 3.0;

// =============================================================================
// XP / Leveling
// =============================================================================
export const XP_PER_KILL = 500;
export const XP_BASE_THRESHOLD = 1000;
export const XP_THRESHOLD_INCREMENT = 100;
export const LEVEL_UP_GLOW_DURATION = 3.0;

// =============================================================================
// Boar color presets
// =============================================================================
export const BOAR_COLOR_PRESETS = [
  { name: "Natural", hex: "#ffffff" },
  { name: "Dark Brown", hex: "#6b3a2a" },
  { name: "Russet", hex: "#a0522d" },
  { name: "Grey", hex: "#808080" },
  { name: "Black", hex: "#2a2a2a" },
  { name: "Albino", hex: "#f5e6d3" },
  { name: "Golden", hex: "#daa520" },
  { name: "Olive", hex: "#6b8e23" },
  { name: "Frost", hex: "#b0c4de" },
  { name: "Sandy", hex: "#d2b48c" },
  { name: "Pink", hex: "#e75480" },
  { name: "Purple", hex: "#7b2d8e" },
];
