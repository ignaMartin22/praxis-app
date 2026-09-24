let contador = 0;

export function nombreCanalUnico(base: string) {
  contador += 1;
  return `${base}-${contador}`;
}