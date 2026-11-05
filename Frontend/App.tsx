import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, PiggyBank } from 'lucide-react-native';
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
import { initDatabase } from './src/database/initDb';
import { authService } from './src/services/authService';
import { budgetService } from './src/services/budgetService';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { MIN_TOUCH, TYPOGRAPHY } from './src/theme/theme';

// Sigue visible hasta aplicar el tema y las fuentes, para evitar un destello (sección 8 de la guía)
SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
        tabBarIcon: ({ color, size }) =>
          route.name === 'Inicio' ? <House color={color} size={size} /> : <PiggyBank color={color} size={size} />,
      })}
    >
      <Tab.Screen name="Inicio" component={MenuScreen} />
      <Tab.Screen name="Metas" component={GoalsScreen} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { colors, isDark, isReady: isThemeReady } = useTheme();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  // Si las fuentes fallan, la app continúa con la fuente del sistema
  const isReady = isThemeReady && (fontsLoaded || !!fontError) && !!initialRoute;

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
    bootstrapApp();
  }, []);

  const bootstrapApp = async () => {
    try {
      // 1. Inicializar SQLite
      await initDatabase();

      // 2. Verificar si hay sesión activa
      const session = await authService.getActiveSession();
      if (session) {
        // 3. Verificar si ya configuró su presupuesto inicial
        const budget = await budgetService.getBudgetByUserId(session.id);
        if (budget) {
          setInitialRoute('Menu');
        } else {
          setInitialRoute('BudgetSetup');
        }
      } else {
        setInitialRoute('Login');
      }
    } catch (error) {
      console.error('Error durante el arranque:', error);
      setInitialRoute('Login');
    }
  };

  if (!isReady) return null;

  return (
    <>
      {/* Toda pantalla inicia con la cabecera en gradiente: los iconos de la barra siempre son claros */}
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="BudgetSetup" component={BudgetSetupScreen} />
          <Stack.Screen name="Menu" component={MainTabs} />
          <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
          <Stack.Screen name="VoiceExpense" component={VoiceExpenseScreen} />
          <Stack.Screen name="ScannerExpense" component={ScannerExpenseScreen} />
          <Stack.Screen name="CreateGoal" component={CreateGoalScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
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