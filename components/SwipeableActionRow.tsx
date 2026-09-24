// components/SwipeableActionRow.tsx
import React, { useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export const ACTION_WIDTH = 96;
const OVERSHOOT = 24;

type SwipeableActionRowProps = {
  actionLabel: string;
  actionColor: string;
  onPress: () => void;
  onAction: () => void;
  children: React.ReactNode;
};

export default function SwipeableActionRow({
  actionLabel,
  actionColor,
  onPress,
  onAction,
  children,
}: SwipeableActionRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const abiertoRef = useRef(false);

  const animarA = (abierto: boolean) => {
    abiertoRef.current = abierto;
    Animated.spring(translateX, {
      toValue: abierto ? -ACTION_WIDTH : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const base = abiertoRef.current ? -ACTION_WIDTH : 0;
        let x = Math.min(0, base + g.dx);
        // Resistencia elástica al pasarse del ancho de la acción
        if (x < -ACTION_WIDTH) {
          x = -ACTION_WIDTH + (x + ACTION_WIDTH) * 0.3;
          x = Math.max(x, -ACTION_WIDTH - OVERSHOOT);
        }
        translateX.setValue(x);
      },
      onPanResponderRelease: (_, g) => {
        const base = abiertoRef.current ? -ACTION_WIDTH : 0;
        const x = base + g.dx;
        // El fling rápido manda; si no, decide la posición
        const abrir = g.vx < -0.5 ? true : g.vx > 0.5 ? false : x < -ACTION_WIDTH / 2;
        animarA(abrir);
      },
      onPanResponderTerminate: () => animarA(abiertoRef.current),
    })
  ).current;

  // En reposo la acción es invisible => no hay botón fantasma
  const fondoOpacity = translateX.interpolate({
    inputRange: [-16, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const contenidoOpacity = translateX.interpolate({
    inputRange: [-60, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const contenidoScale = translateX.interpolate({
    inputRange: [-ACTION_WIDTH, 0],
    outputRange: [1, 0.7],
    extrapolate: 'clamp',
  });

  const handleCardPress = () => {
    if (abiertoRef.current) animarA(false); // si está abierta, tocar la tarjeta la cierra
    else onPress();
  };

  const handleAction = () => {
    animarA(false); // se cierra siempre; si cancelás el Alert queda en su lugar
    onAction();
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: actionColor, opacity: fondoOpacity }]}
      >
        <Pressable style={styles.action} onPress={handleAction}>
          <Animated.View
            style={[
              styles.actionContenido,
              { opacity: contenidoOpacity, transform: [{ scale: contenidoScale }] },
            ]}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Animated.View>
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[styles.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={handleCardPress}
          style={({ pressed }) => [styles.contenido, pressed && styles.presionado]}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  action: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContenido: { alignItems: 'center', gap: 2 },
  actionText: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: colors.navyElevated, // opaco
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  contenido: {
    padding: spacing.md,
    backgroundColor: colors.navyElevated,
  },
  presionado: {
    backgroundColor: colors.navySoft, // feedback por color, no por opacidad
  },
});