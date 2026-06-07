export const Colors = {
  primary:       '#6B2FA0',   // EasyPark purple
  primaryDark:   '#4A1F72',
  primaryLight:  '#F3EDFB',
  accent:        '#FF6B00',
  green:         '#00A651',
  greenLight:    '#E6F7EE',
  red:           '#E63946',
  redLight:      '#FDECEA',
  orange:        '#F4801A',
  orangeLight:   '#FEF3E2',
  // Neutrals
  white:         '#FFFFFF',
  light:         '#F5F6FA',
  border:        '#E8E8EE',
  borderLight:   '#F2F2F7',
  text:          '#111118',
  textSecondary: '#4A4A5A',
  muted:         '#9090A0',
  // Badges
  badgeBg:       '#F3EDFB',
  badgeText:     '#6B2FA0',
  tagGreenBg:    '#E6F7EE',
  tagGreenText:  '#00A651',
  tagRedBg:      '#FDECEA',
  tagRedText:    '#E63946',
  tagBlueBg:     '#EBF3FF',
  tagBlueText:   '#1A56DB',
  tagAmberBg:    '#FEF3E2',
  tagAmberText:  '#F4801A',
  // Zone P-badge
  zoneBadge:     '#1A56DB',
  // Map overlay
  mapOverlay:    'rgba(255,255,255,0.97)',
};

export const Typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: Colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  h3: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  body: { fontSize: 14, fontWeight: '400' as const, color: Colors.text },
  small: { fontSize: 12, fontWeight: '400' as const, color: Colors.muted },
  mono: { fontFamily: 'Courier', fontSize: 14, fontWeight: '700' as const },
};

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24,
};

export const BorderRadius = {
  sm: 6, md: 10, lg: 16, xl: 24, pill: 100, full: 999,
};
