import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Alert, View } from 'react-native';
import { ChartPie, House, PiggyBank, Users } from 'lucide-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import LoginScreen from './screens/LoginScreen';
import MenuScreen from './screens/MenuScreen';
import BudgetSetupScreen from './screens/BudgetSetupScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import VoiceExpenseScreen from './screens/VoiceExpenseScreen';
import ScannerExpenseScreen from './screens/ScannerExpenseScreen';
import GoalsScreen from './screens/GoalsScreen';
import CreateGoalScreen from './screens/CreateGoalScreen';
import SettingsScreen from './screens/SettingsScreen';
import HistoryScreen from './screens/HistoryScreen';
import EditExpenseScreen from './screens/EditExpenseScreen';
import ReportsScreen from './screens/ReportsScreen';
import GroupsScreen from './screens/GroupsScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import { ApiError, despertarServidor, mensajeDeError, onSesionExpirada } from './src/api/client';
import NetworkBanner from './src/components/ui/NetworkBanner';
import { ErrorState } from './src/components/ui/States';
import { authService } from './src/services/authService';
import { budgetService } from './src/services/budgetService';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { MIN_TOUCH, TYPOGRAPHY } from './src/theme/theme';

// Sigue visible hasta aplicar el tema y las fuentes, para evitar un destello (sección 8 de la guía)
SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, typeof House> = { Inicio: House, Reportes: ChartPie, Grupos: Users, Metas: PiggyBank };

const navigationRef = createNavigationContainerRef<any>();

/** S3-01: navegación inferior entre el Dashboard y las Metas. */
function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.divider },
        tabBarLabelStyle: TYPOGRAPHY.caption,
        tabBarItemStyle: { minHeight: MIN_TOUCH },
        tabBarIcon: ({ color, size }) => {
          const Icon = TAB_ICONS[route.name];
          return <Icon color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Inicio" component={MenuScreen} />
      <Tab.Screen name="Reportes" component={ReportsScreen} />
      <Tab.Screen name="Grupos" component={GroupsScreen} />
      <Tab.Screen name="Metas" component={GoalsScreen} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { colors, isDark, isReady: isThemeReady } = useTheme();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  // Si las fuentes fallan, la app continúa con la fuente del sistema
  const isReady = isThemeReady && (fontsLoaded || !!fontError) && (!!initialRoute || !!bootError);

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync().catch(() => {});
  }, [isReady]);

  // Tema de navegación: evita destellos entre pantallas
  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.divider,
      },
    };
  }, [colors, isDark]);

  useEffect(() => {
    despertarServidor();
    bootstrapApp();
    // S7-04: si el servidor rechaza el token, se regresa a Login desde cualquier pantalla
    const quitar = onSesionExpirada(() => {
      authService.logout();
      if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name !== 'Login') {
        navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
        Alert.alert('Sesión expirada', 'Tu sesión expiró. Vuelve a iniciar sesión.');
      }
    });
    return () => {
      quitar();
    };
  }, []);

  const bootstrapApp = async () => {
    setBootError(null);
    try {
      // 1. Sesión guardada en el teléfono (no necesita red)
      const session = await authService.getActiveSession();
      if (!session) {
        setInitialRoute('Login');
        return;
      }
      // 2. ¿Ya configuró su presupuesto? Esto sí necesita al servidor
      const budget = await budgetService.getBudgetByUserId(session.id);
      setInitialRoute(budget ? 'Menu' : 'BudgetSetup');
    } catch (error) {
      if (error instanceof ApiError && error.tipo === 'SesionExpirada') {
        await authService.logout();
        setInitialRoute('Login');
        return;
      }
      // Escenario 6: sin red al abrir, se conserva la sesión y se ofrece reintentar
      console.error('Error durante el arranque:', error);
      setBootError(mensajeDeError(error));
    }
  };

  if (!isReady) return null;

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <NetworkBanner />
        <ErrorState message={bootError ?? 'No pudimos conectar con Carterita.'} onRetry={bootstrapApp} />
      </View>
    );
  }

  return (
    <>
      {/* Toda pantalla inicia con la cabecera en gradiente: los iconos de la barra siempre son claros */}
      <StatusBar style="light" />
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="BudgetSetup" component={BudgetSetupScreen} />
          <Stack.Screen name="Menu" component={MainTabs} />
          <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
          <Stack.Screen name="VoiceExpense" component={VoiceExpenseScreen} />
          <Stack.Screen name="ScannerExpense" component={ScannerExpenseScreen} />
          <Stack.Screen name="CreateGoal" component={CreateGoalScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="EditExpense" component={EditExpenseScreen} />
          <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <NetworkBanner />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}