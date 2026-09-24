import React, { useEffect, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';
import type { RootStackParamList } from '../types/navigation';

type SideDrawerProps = {
  visible: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export default function SideDrawer({ visible, onOpen, onClose }: SideDrawerProps) {
  const { session, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const email = session?.user.email ?? '';
  const avatarLetter = email.charAt(0).toUpperCase() || '?';

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateX, visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dx < -8,
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(Math.max(-DRAWER_WIDTH, gestureState.dx));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -DRAWER_WIDTH / 3 || gestureState.vx < -0.5) {
          onClose();
          return;
        }
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const edgePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dx > 8,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > DRAWER_WIDTH / 3 || gestureState.vx > 0.5) onOpen();
      },
    })
  ).current;

  async function handleSignOut() {
    onClose();
    await signOut();
  }

  function irA(screen: 'Home' | 'ExpedientesArchivados') {
    navigation.navigate(screen);
    onClose();
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {!visible && <View {...edgePanResponder.panHandlers} style={styles.edgeSwipeZone} />}
      {visible && <Pressable style={styles.backdrop} onPress={onClose} />}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        {...panResponder.panHandlers}
        style={[styles.drawer, { transform: [{ translateX }] }]}
      >
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>PRAXISAPP</Text>
          <TouchableOpacity accessibilityLabel="Cerrar menú" onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.mist} />
          </TouchableOpacity>
        </View>
        <View style={styles.profileSection}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{avatarLetter}</Text></View>
          <Text style={styles.email} numberOfLines={2}>{email}</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.editProfile}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionLabel}>NAVEGACIÓN</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => irA('Home')}>
            <Ionicons name="home-outline" size={20} color={colors.gold} style={styles.menuIcon} />
            <Text style={styles.menuText}>Inicio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => irA('ExpedientesArchivados')}>
            <Ionicons name="archive-outline" size={20} color={colors.gold} style={styles.menuIcon} />
            <Text style={styles.menuText}>Expedientes archivados</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={22} color={colors.goldBright} style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export const DRAWER_WIDTH = 304;

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  edgeSwipeZone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 28 },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.navyElevated,
    paddingHorizontal: spacing.lg,
    paddingTop: 64,
    paddingBottom: spacing.lg,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    elevation: 12,
  },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  drawerTitle: { color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  profileSection: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.lg },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText: { color: colors.navy, fontSize: 25, fontWeight: '700' },
  email: { color: colors.ivory, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  editProfile: { color: colors.goldBright, fontSize: 13, marginTop: spacing.sm },
  menuSection: { flex: 1, paddingTop: spacing.xl },
  sectionLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: spacing.md },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  menuIcon: { width: 30 },
  menuText: { color: colors.mist, fontSize: 16 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  logoutIcon: { width: 30 },
  logoutText: { color: colors.ivory, fontSize: 15, fontWeight: '600' },
});