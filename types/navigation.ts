import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  CrearExpediente: undefined;
  ExpedienteDetalle: { expedienteId: string };
  ExpedientesArchivados: undefined;
};

export type LoginProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
export type RegisterProps = NativeStackScreenProps<RootStackParamList, 'Register'>;
export type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type CrearExpedienteProps = NativeStackScreenProps<RootStackParamList, 'CrearExpediente'>;
export type ExpedienteDetalleProps = NativeStackScreenProps<RootStackParamList, 'ExpedienteDetalle'>;
export type ExpedientesArchivadosProps = NativeStackScreenProps<RootStackParamList, 'ExpedientesArchivados'>;
