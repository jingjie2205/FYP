// constants/Colors.ts
export const PALETTE = {
  // Midnight background levels
  bgBase: "#070D14",
  bgSurface: "#0C1521",
  bgCard: "#121E2C",
  bgCardHover: "#162536",

  // Borders
  borderSubtle: "#162232",
  borderMedium: "#192839",
  borderActive: "#1E2D3D",

  // Brand / Mint Accents
  emeraldPrimary: "#00D293",
  emeraldDark: "#0C2028",
  emeraldBorder: "#174747",
  emeraldText: "#9EE5CF",

  // Expense / Alert Accents
  coralExpense: "#FF6B6B",
  coralDark: "#1D1620",
  coralBorder: "#3D2028",

  // Typography
  textPrimary: "#FFFFFF",
  textSecondary: "#8295AB",
  textMuted: "#64748B",
  textDim: "#475569",
};

// Expo default hooks compatibility (useThemeColor)
export const Colors = {
  light: {
    text: PALETTE.textPrimary,
    background: PALETTE.bgBase,
    surface: PALETTE.bgSurface,
    card: PALETTE.bgCard,
    tint: PALETTE.emeraldPrimary,
    icon: PALETTE.textSecondary,
    tabIconDefault: PALETTE.textMuted,
    tabIconSelected: PALETTE.emeraldPrimary,
  },
  dark: {
    text: PALETTE.textPrimary,
    background: PALETTE.bgBase,
    surface: PALETTE.bgSurface,
    card: PALETTE.bgCard,
    tint: PALETTE.emeraldPrimary,
    icon: PALETTE.textSecondary,
    tabIconDefault: PALETTE.textMuted,
    tabIconSelected: PALETTE.emeraldPrimary,
  },
};

// Global legacy COLORS export required by existing stylesheets
export const COLORS = {
  background: PALETTE.bgBase,
  card: PALETTE.bgSurface,
  surface: PALETTE.bgCard,
  text: PALETTE.textPrimary,
  textLight: PALETTE.textSecondary,
  textMuted: PALETTE.textMuted,
  white: "#FFFFFF",
  border: PALETTE.borderMedium,
  primary: PALETTE.emeraldPrimary,
  income: PALETTE.emeraldPrimary,
  expense: PALETTE.coralExpense,
  shadow: "#000000",
};

export default COLORS;