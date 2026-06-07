// src/utils/theme.ts
export const Colors = {
  primary: '#1A3A6B',
  accent: '#E8A020',
  green: '#1B7A4A',
  red: '#C0392B',
  sky: '#2E86C1',
  light: '#F0F4FA',
  white: '#FFFFFF',
  border: '#D8E2EF',
  text: '#1C2940',
  muted: '#6B7A99',
  badgeBg: '#E8F0FE',
  badgeText: '#1A3A6B',
  tagGreenBg: '#E6F4ED',
  tagGreenText: '#1B7A4A',
  tagRedBg: '#FDECEA',
  tagRedText: '#C0392B',
  tagBlueBg: '#E8F0FE',
  tagBlueText: '#1A3A6B',
  tagAmberBg: '#FEF3E2',
  tagAmberText: '#A0530A',
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
  sm: 8, md: 10, lg: 14, xl: 20, pill: 100,
};