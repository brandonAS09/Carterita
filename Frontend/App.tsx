import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, PiggyBank } from 'lucide-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import MenuScreen from './screens/MenuScreen';
import BudgetSetupScreen from './screens/BudgetSetupScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import VoiceExpenseScreen from './screens/VoiceExpenseScreen';
import GoalsScreen from './screens/GoalsScreen';
import CreateGoalScreen from './screens/CreateGoalScreen';
import { initDatabase } from './src/database/initDb';
import { authService } from './src/services/authService';
import { budgetService } from './src/services/budgetService';
import { COLORS } from './src/theme/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tema oscuro de navegación (evita destellos blancos entre pantallas)
const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: COLORS.secondary,
    background: COLORS.background,
    card: COLORS.tertiary,
    text: COLORS.text,
    border: COLORS.primary,
  },
};

/** S3-01: navegación inferior entre el Dashboard y las Metas. */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.secondary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: { backgroundColor: COLORS.tertiary, borderTopColor: COLORS.primary },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color, size }) =>
          route.name === 'Inicio' ? <House color={color} size={size} /> : <PiggyBank color={color} size={size} />,
      })}
    >
      <Tab.Screen name="Inicio" component={MenuScreen} />
      <Tab.Screen name="Metas" component={GoalsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

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

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={NAV_THEME}>
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="BudgetSetup" component={BudgetSetupScreen} />
          <Stack.Screen name="Menu" component={MainTabs} />
          <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
          <Stack.Screen name="VoiceExpense" component={VoiceExpenseScreen} />
          <Stack.Screen name="CreateGoal" component={CreateGoalScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}