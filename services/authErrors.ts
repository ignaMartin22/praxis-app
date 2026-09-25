// Traducción de errores de auth a mensajes seguros para el usuario (RF-07):
// nunca se exponen stack traces, identificadores internos ni texto crudo del backend.
export type ErrorAuthInfo = {
  code?: string;
  status?: number;
  message?: string;
};

export function mensajeErrorAuth(error: ErrorAuthInfo | null | undefined): string {
  const code = (error?.code ?? '').toLowerCase();
  const status = error?.status ?? 0;

  if (code.includes('invalid_credentials')) {
    return 'El correo o la contraseña son incorrectos.';
  }
  if (code.includes('email_not_confirmed')) {
    return 'Confirmá tu email para activar tu cuenta.';
  }
  if (code.includes('email_exists') || code.includes('user_already_exists')) {
    return 'Ya existe una cuenta con ese correo.';
  }
  if (code.includes('weak_password')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (code.includes('rate_limit') || status === 429) {
    return 'Demasiados intentos. Esperá unos minutos y volvé a intentar.';
  }

  return 'No se pudo completar la acción. Intentá de nuevo.';
}