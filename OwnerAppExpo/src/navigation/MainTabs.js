import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import CustomerStack from './CustomerStack';
import PaymentListScreen from '../screens/payment/PaymentListScreen';
import SettingsStack from './SettingsStack';
import { colors } from '../theme/theme';

const Tab = createBottomTabNavigator();

const ICONS = {
  Dashboard: '🏠',
  Customers: '👥',
  Payments: '💳',
  Settings: '⚙️',
};

const MainTabs = ({ onLogout }) => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 20 }}>{ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Customers" component={CustomerStack} />
      <Tab.Screen name="Payments" component={PaymentListScreen} />
      <Tab.Screen name="Settings">
        {(props) => <SettingsStack {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default MainTabs;
