import { Stack } from 'expo-router';
import React from 'react';

// This group previously rendered its own expo-router Tabs bar (Home /
// Explore) wrapping the "index" route, which itself renders MainTabs (the
// app's real Dashboard/Customers/Renewals/Payments/Settings navigation) —
// producing two visible tab bars stacked on top of each other. "Explore"
// was unused default-template boilerplate, never linked to any CRM
// feature. A plain headerless Stack removes the outer bar entirely while
// keeping the existing route file/path (app/(tabs)/index.tsx) untouched,
// so MainTabs remains the single, correct navigation.
export default function TabLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
