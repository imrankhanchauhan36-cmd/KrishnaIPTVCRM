import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from '../screens/settings/SettingsScreen';
import PlanScreen from '../screens/plan/PlanScreen';
import EmployeeScreen from '../screens/employee/EmployeeScreen';
import PortalScreen from '../screens/portal/PortalScreen';

const Stack = createNativeStackNavigator();

const SettingsStack = ({ onLogout }) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsMain">
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="Plans" component={PlanScreen} />
      <Stack.Screen name="Employees" component={EmployeeScreen} />
      <Stack.Screen name="Portals" component={PortalScreen} />
    </Stack.Navigator>
  );
};

export default SettingsStack;
