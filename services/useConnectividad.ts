import { useEffect, useState } from 'react';
import { getIsOnline, suscribirOnline } from './connectividad';

export function useOnline(): boolean {
  const [online, setOnline] = useState(getIsOnline());

  useEffect(() => suscribirOnline(setOnline), []);

  return online;
}