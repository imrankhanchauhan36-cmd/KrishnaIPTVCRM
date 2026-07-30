// Shared design tokens for a clean, professional "accounting software" look
// (inspired by Tally/Excel-style business apps)

export const colors = {
  background: '#f4f5f7',
  surface: '#ffffff',
  surfaceAlt: '#f0f1f4',
  border: '#d9dce1',
  primary: '#1e4d8b',
  primaryLight: '#e8f0fb',
  text: '#1a1d24',
  textSecondary: '#5c6270',
  textMuted: '#8a909c',
  success: '#1a7f37',
  successBg: '#e6f4ea',
  danger: '#b3261e',
  dangerBg: '#fbe9e7',
  headerBg: '#1e4d8b',
  headerText: '#ffffff',
  tableHeaderBg: '#eef1f6',
  tableRowAlt: '#fafbfc',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const typography = {
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' },
  body: { fontSize: 14, color: colors.text },
  bodyMuted: { fontSize: 13, color: colors.textMuted },
};

export const commonStyles = {
  card: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
};
