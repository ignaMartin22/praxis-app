import { Platform } from 'react-native';

export const colors = {
  navy: '#081525',
  navyElevated: '#0D1E33',
  navySoft: '#112842',
  navyInput: '#0A192B',
  gold: '#C7A56A',
  goldBright: '#E0C58D',
  goldMuted: '#806A42',
  ivory: '#F4F1EA',
  mist: '#C7CBD2',
  muted: '#8792A2',
  border: '#26384D',
  borderSoft: '#1A2D43',
  danger: '#D78378',
  success: '#91B69A',
  overlay: 'rgba(3, 10, 19, 0.78)',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const font = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.22,
  shadowRadius: 18,
  elevation: 6,
};
