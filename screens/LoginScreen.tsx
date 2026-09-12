import React, { useState } from 'react';
import { View, TextInput, Button, Text, Alert, StyleSheet } from 'react-native';
import { supabase } from '../supabase';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Error', error.message);
    setLoading(false);
    // No hace falta navegar manualmente: el AuthContext detecta la sesión
    // y App.tsx se encarga de mostrar la pantalla principal automáticamente.
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar sesión</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title={loading ? 'Ingresando...' : 'Ingresar'} onPress={handleLogin} disabled={loading} />
      <Text onPress={() => navigation.navigate('Register')} style={styles.link}>
        Crear una cuenta
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  link: { marginTop: 16, color: '#0066cc', textAlign: 'center' },
});