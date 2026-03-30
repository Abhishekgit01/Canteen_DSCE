export const palette = {
  brand: '#8B1A1A',
  accent: '#F5821F',
  accentSoft: '#FF9F43',
  background: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F0ED',
  surfaceRaised: '#FFF5EA',
  ink: '#1A1A1A',
  muted: '#666666',
  subtle: '#A0A0A0',
  line: '#E9E3DC',
  success: '#2E8B57',
  successSoft: '#EAF8EE',
  warningSoft: '#FFF4E7',
  info: '#2563EB',
  infoSoft: '#EAF1FF',
  danger: '#DC2626',
  dangerSoft: '#FEECEC',
} as const;

export const shadows = {
  card: {
    shadowColor: 'rgba(36, 22, 14, 0.14)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 5,
  },
  floating: {
    shadowColor: 'rgba(36, 22, 14, 0.2)',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 8,
  },
} as const;
