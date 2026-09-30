export const THEME_IDS = [
  "zitan",
  "obsidian",
  "white-jade",
  "celadon",
  "walnut",
  "ink",
  "minimal",
  "jade-gold",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_LABEL: Record<ThemeId, string> = {
  zitan: "紫檀鎏金",
  obsidian: "黑曜夜局",
  "white-jade": "白玉宫廷",
  celadon: "青玉雅集",
  walnut: "胡桃木经典",
  ink: "水墨",
  minimal: "现代极简",
  "jade-gold": "翡翠鎏金",
};

export interface ThemeVars {
  page: string;
  ink: string;
  muted: string;
  card: string;
  line: string;
  board: string;
  edge: string;
  grid: string;
  river: string;
  piece: string;
  red: string;
  black: string;
  pieceEdge: string;
  dest: string;
  pendingFrom: string;
  pendingTo: string;
  last: string;
  check: string;
  select: string;
}

export const THEMES: Record<ThemeId, ThemeVars> = {
  zitan: { page: "#161014", ink: "#f6efe4", muted: "#cbbba6", card: "#24181c", line: "#3d2a30", board: "#5a3028", edge: "#2c1614", grid: "#e4c98a", river: "#e4c98a", piece: "#f7f0e4", red: "#c45c4e", black: "#1a120e", pieceEdge: "#d7b56a", dest: "#3cba6c", pendingFrom: "#d08a3a", pendingTo: "#3cba6c", last: "#e4c98a", check: "#d4534a", select: "#e4c98a" },
  obsidian: { page: "#101114", ink: "#f3efe6", muted: "#b7b1a6", card: "#1b1d22", line: "#2e3138", board: "#2a241c", edge: "#0e0f12", grid: "#c6a15b", river: "#c6a15b", piece: "#f6f1e6", red: "#d06a55", black: "#141210", pieceEdge: "#b9965a", dest: "#3cba6c", pendingFrom: "#c4893a", pendingTo: "#3cba6c", last: "#c6a15b", check: "#d4534a", select: "#c6a15b" },
  "white-jade": { page: "#f7f4ef", ink: "#241c18", muted: "#6f645c", card: "#fffdfb", line: "#eadfd4", board: "#f6f1e8", edge: "#e4d5c4", grid: "#8d3b3b", river: "#8d3b3b", piece: "#fffaf6", red: "#9d2c2c", black: "#1c1915", pieceEdge: "#c9a27a", dest: "#2f9e44", pendingFrom: "#c47a32", pendingTo: "#2f9e44", last: "#c4a574", check: "#b42318", select: "#8d3b3b" },
  celadon: { page: "#eef3ef", ink: "#1c2822", muted: "#5d6d64", card: "#f7faf7", line: "#d5e2d8", board: "#d7e2d4", edge: "#6e8b78", grid: "#3e5348", river: "#3e5348", piece: "#f8f6f0", red: "#8d3d3d", black: "#1e2a24", pieceEdge: "#8aa38f", dest: "#2f8f55", pendingFrom: "#c4893a", pendingTo: "#2f8f55", last: "#8aa38f", check: "#a33b32", select: "#3e5348" },
  walnut: { page: "#f6f1ea", ink: "#1c1915", muted: "#6f675f", card: "#fffdf9", line: "#e6d8c8", board: "#e7d3a4", edge: "#6b4a2a", grid: "#5c4632", river: "#5c4632", piece: "#f8f1e4", red: "#9d2c2c", black: "#1d1a17", pieceEdge: "#a67c52", dest: "#2f9e44", pendingFrom: "#d07a16", pendingTo: "#2f9e44", last: "#c4a15a", check: "#b03030", select: "#2f6fed" },
  ink: { page: "#f4f1ec", ink: "#1a1a1a", muted: "#5e5a55", card: "#faf8f5", line: "#e4ddd4", board: "#efeae2", edge: "#2c2c2c", grid: "#2a2a2a", river: "#2a2a2a", piece: "#fbfaf7", red: "#a33b32", black: "#1a1a1a", pieceEdge: "#8d8680", dest: "#2f9e44", pendingFrom: "#b7791f", pendingTo: "#2f9e44", last: "#a33b32", check: "#a33b32", select: "#2a2a2a" },
  minimal: { page: "#f5f5f7", ink: "#1d1d1f", muted: "#6e6e73", card: "#ffffff", line: "#e5e5ea", board: "#f3f1ec", edge: "#d2d2d7", grid: "#3a3a3c", river: "#6e6e73", piece: "#ffffff", red: "#b42318", black: "#1d1d1f", pieceEdge: "#c7c7cc", dest: "#248a3d", pendingFrom: "#b86e00", pendingTo: "#248a3d", last: "#8e8e93", check: "#b42318", select: "#0071e3" },
  "jade-gold": { page: "#10211c", ink: "#f6f1e6", muted: "#c5d2c8", card: "#173028", line: "#2a4a3e", board: "#1f4a3d", edge: "#0c1915", grid: "#d4bc86", river: "#d4bc86", piece: "#f6f1e6", red: "#d07a62", black: "#12201b", pieceEdge: "#d4bc86", dest: "#7dcea0", pendingFrom: "#d4a017", pendingTo: "#7dcea0", last: "#d4bc86", check: "#e07a6a", select: "#d4bc86" },
};

export function themeStyle(theme: ThemeVars): Record<string, string> {
  return {
    "--xq-page": theme.page,
    "--xq-ink": theme.ink,
    "--xq-muted": theme.muted,
    "--xq-card": theme.card,
    "--xq-line": theme.line,
    "--xq-board": theme.board,
    "--xq-edge": theme.edge,
    "--xq-grid": theme.grid,
    "--xq-river": theme.river,
    "--xq-piece": theme.piece,
    "--xq-red": theme.red,
    "--xq-black": theme.black,
    "--xq-piece-edge": theme.pieceEdge,
    "--xq-dest": theme.dest,
    "--xq-pending-from": theme.pendingFrom,
    "--xq-pending-to": theme.pendingTo,
    "--xq-last": theme.last,
    "--xq-check": theme.check,
    "--xq-select": theme.select,
  };
}

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}
