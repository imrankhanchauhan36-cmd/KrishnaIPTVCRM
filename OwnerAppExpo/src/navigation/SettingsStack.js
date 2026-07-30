import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from '../screens/settings/SettingsScreen';
import PlanScreen from '../screens/plan/PlanScreen';

const Stack = createNativeStackNavigator();

const SettingsStack = ({ onLogout }) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsMain">
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="Plans" component={PlanScreen} />
    </Stack.Navigator>
  );
};

export default SettingsStack;
