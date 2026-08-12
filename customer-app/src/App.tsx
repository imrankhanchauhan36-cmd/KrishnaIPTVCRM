import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/LoginScreen';
import OtpScreen from './screens/OtpScreen';
import DashboardScreen from './screens/DashboardScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import type { Session } from './types';

type Route = 'login' | 'otp' | 'dashboard' | 'notifications';

const AppShell: React.FC = () => {
  const { session, login } = useAuth();
  const [route, setRoute] = useState<Route>(session ? 'dashboard' : 'login');
  const [pendingPhone, setPendingPhone] = useState('');
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);

  if (!session) {
    if (route === 'otp') {
      return (
        <OtpScreen
          phone={pendingPhone}
          devOtp={devOtp}
          onBack={() => setRoute('login')}
          onVerified={(result: Session) => {
            login(result);
            setRoute('dashboard');
          }}
        />
      );
    }
    return (
      <LoginScreen
        onOtpRequested={(phone, otp) => {
          setPendingPhone(phone);
          setDevOtp(otp);
          setRoute('otp');
        }}
      />
    );
  }

  if (route === 'notifications') {
    return <NotificationsScreen onBack={() => setRoute('dashboard')} />;
  }

  return <DashboardScreen onOpenNotifications={() => setRoute('notifications')} />;
};

const App: React.FC = () => (
  <AuthProvider>
    <AppShell />
  </AuthProvider>
);

export default App;
