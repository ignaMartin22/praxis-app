import React, { useState } from 'react';
import { View, TextInput, Text, Alert, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../supabase';
import { colors, radius, spacing } from '../theme';
import type { LoginProps } from '../types/navigation';

export default function LoginScreen({ navigation }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('No pudimos ingresar', error.message);
    setLoading(false);
  }
  return <View style={styles.container}>
    <View style={styles.brandBlock}><Image source={require('../assets/Praxis_Logo.png')} style={styles.logo} /><Text style={styles.eyebrow}>PRAXISAPP</Text><Text style={styles.title}>Tu práctica,{"\n"}en orden.</Text><Text style={styles.description}>Gestión profesional de expedientes, diseñada para abogados.</Text></View>
    <View style={styles.form}>
      <Text style={styles.formTitle}>Iniciar sesión</Text>
      <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
      <TextInput style={styles.input} placeholder="nombre@estudio.com" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <Text style={styles.label}>CONTRASEÑA</Text>
      <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={[styles.primaryButton, loading && styles.disabled]} onPress={handleLogin} disabled={loading}>{loading ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.primaryButtonText}>Ingresar</Text>}</TouchableOpacity>
      <Text onPress={() => navigation.navigate('Register')} style={styles.link}>¿Primera vez? <Text style={styles.linkAccent}>Crear cuenta</Text></Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy, padding: spacing.lg, justifyContent: 'center' },
  brandBlock: { marginBottom: spacing.xxl }, logo: { width: 72, height: 72, borderRadius: 20, marginBottom: spacing.lg }, eyebrow: { color: colors.gold, fontSize: 12, fontWeight: '700', letterSpacing: 2.8, marginBottom: spacing.md }, title: { color: colors.ivory, fontSize: 34, fontWeight: '700', letterSpacing: -0.7, lineHeight: 40 }, description: { color: colors.mist, fontSize: 15, lineHeight: 22, marginTop: spacing.md, maxWidth: 290 },
  form: { backgroundColor: colors.navyElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }, formTitle: { color: colors.ivory, fontSize: 19, fontWeight: '600', marginBottom: spacing.lg }, label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginBottom: spacing.sm },
  input: { color: colors.ivory, backgroundColor: colors.navyInput, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 50, marginBottom: spacing.md, fontSize: 15 }, primaryButton: { height: 52, backgroundColor: colors.gold, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm }, primaryButtonText: { color: colors.navy, fontWeight: '700', fontSize: 16 }, disabled: { opacity: 0.6 }, link: { marginTop: spacing.lg, color: colors.mist, textAlign: 'center', fontSize: 14 }, linkAccent: { color: colors.goldBright, fontWeight: '600' },
});
