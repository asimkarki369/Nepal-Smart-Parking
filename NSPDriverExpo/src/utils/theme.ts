export const Colors = {
  // EasyPark-style bright blue
  primary: '#006EE6',
  primaryDark: '#0055B8',
  primaryLight: '#E8F2FF',
  accent: '#FF6B00',
  green: '#00A651',
  greenLight: '#E6F7EE',
  red: '#E63946',
  redLight: '#FDECEA',
  orange: '#F4801A',
  orangeLight: '#FEF3E2',
  // Neutrals
  white: '#FFFFFF',
  light: '#F5F7FA',
  border: '#E4E8EF',
  borderLight: '#F0F3F7',
  text: '#0D1B2A',
  textSecondary: '#4A5568',
  muted: '#8A97A8',
  // Badges
  badgeBg: '#E8F2FF',
  badgeText: '#006EE6',
  tagGreenBg: '#E6F7EE',
  tagGreenText: '#00A651',
  tagRedBg: '#FDECEA',
  tagRedText: '#E63946',
  tagBlueBg: '#E8F2FF',
  tagBlueText: '#006EE6',
  tagAmberBg: '#FEF3E2',
  tagAmberText: '#F4801A',
  // Map overlay
  mapOverlay: 'rgba(255,255,255,0.97)',
};

export const Typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, color: Colors.text },
  h2: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  h3: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  body: { fontSize: 14, fontWeight: '400' as const, color: Colors.text },
  small: { fontSize: 12, fontWeight: '400' as const, color: Colors.muted },
  mono: { fontFamily: 'Courier', fontSize: 14, fontWeight: '700' as const },
};

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24,
};

export const BorderRadius = {
  sm: 8, md: 10, lg: 14, xl: 20, pill: 100, full: 999,
};
