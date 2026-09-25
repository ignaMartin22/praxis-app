import React, { useState, useEffect } from 'react';
import { View, AppState, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import CrearExpedienteScreen from './screens/CrearExpedienteScreen';
import ExpedienteDetalleScreen from './screens/ExpedienteDetalleScreen';
import ExpedientesArchivadosScreen from './screens/ExpedientesArchivadosScreen';
import { colors } from './theme';
import type { RootStackParamList } from './types/navigation';
import SideDrawer from './components/SideDrawer';
import { initConnectividad } from './services/connectividad';
import { configurarPush, sincronizarPushAlIniciar, sincronizarPushActivo, getEstadoPush } from './services/push';

initConnectividad();

const Stack = createNativeStackNavigator<RootStackParamList>();

// Sincroniza el token de notificaciones (RF-24): al iniciar con sesión y cada vez
// que la app vuelve a foreground. No guarda tokens en AsyncStorage.
function PushSynchronizer() {
  const { session, tenantId } = useAuth();

  useEffect(() => {
    void configurarPush();
  }, []);

  useEffect(() => {
    if (!session?.user || !tenantId) return;

    void (async () => {
      const resultado = await sincronizarPushAlIniciar(tenantId);
      // Solo avisar si el permiso está dado pero el registro realmente falló
      // (así el usuario sabe qué falta: projectId, dev build o la migración).
      if (!resultado.ok && getEstadoPush() === 'otorgado' && resultado.error) {
        Alert.alert('Notificaciones', `${resultado.error}\n\nSin esto no vas a recibir los avisos de vencimiento (RF-24).`);
      }
    })();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void sincronizarPushActivo(tenantId);
    });

    return () => sub.remove();
  }, [session?.user?.id, tenantId]);

  return null;
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const [drawerVisible, setDrawerVisible] = useState(false);

  if (loading) return null; // podríamos poner un spinner acá

  return (
    <View style={{ flex: 1 }}>
      <PushSynchronizer />
      <Stack.Navigator screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors.navy },
      headerStyle: { backgroundColor: colors.navy },
      headerTintColor: colors.ivory,
      headerTitleStyle: { fontWeight: '600' },
      headerShadowVisible: false,
    }}>
      {session ? (
  <>
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="CrearExpediente" component={CrearExpedienteScreen} options={{ headerShown: true, title: 'Nuevo expediente' }} />
  <Stack.Screen name="ExpedienteDetalle" component={ExpedienteDetalleScreen} options={{ headerShown: true, title: 'Expediente' }} />
  <Stack.Screen name="ExpedientesArchivados" component={ExpedientesArchivadosScreen} options={{ headerShown: true, title: 'Expedientes archivados' }} />
  </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
      </Stack.Navigator>
      {session && <SideDrawer visible={drawerVisible} onOpen={() => setDrawerVisible(true)} onClose={() => setDrawerVisible(false)} />}
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
