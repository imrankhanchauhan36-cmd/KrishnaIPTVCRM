import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CustomerListScreen from '../screens/customer/CustomerListScreen';
import CustomerSearchScreen from '../screens/customer/CustomerSearchScreen';
import CustomerFoundScreen from '../screens/customer/CustomerFoundScreen';
import CustomerFormScreen from '../screens/customer/CustomerFormScreen';
import CustomerDetailsScreen from '../screens/customer/CustomerDetailsScreen';
import { colors } from '../theme/theme';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.headerBg },
  headerTintColor: colors.headerText,
  headerTitleStyle: { fontWeight: '700', fontSize: 16 },
  headerBackTitle: 'Back',
};

const CustomerStack = () => {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="CustomerList"
        component={CustomerListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerSearch"
        component={CustomerSearchScreen}
        options={{ title: 'Add Customer' }}
      />
      <Stack.Screen
        name="CustomerFound"
        component={CustomerFoundScreen}
        options={{ title: 'Customer Found' }}
      />
      <Stack.Screen
        name="CustomerForm"
        component={CustomerFormScreen}
        options={({ route }) => ({
          title: route.params?.existingCustomer ? 'Edit Customer' : 'New Customer',
        })}
      />
      <Stack.Screen
        name="CustomerDetails"
        component={CustomerDetailsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default CustomerStack;
