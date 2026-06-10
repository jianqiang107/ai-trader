import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import IndexBar from './IndexBar';
import BottomNews from './BottomNews';
import NotificationCenter from '../common/NotificationCenter';
import LoginDialog from '../common/LoginDialog';
import ProfileDrawer from '../../pages/profile/ProfileDrawer';
import AlertPreferenceDialog from '../../pages/profile/AlertPreferenceDialog';
import { useAuthStore } from '../../stores/useAuthStore';

export default function MainLayout() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [alertPrefOpen, setAlertPrefOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const handleAuthRequired = () => {
      logout();
      setLoginOpen(true);
    };
    window.addEventListener('auth:required', handleAuthRequired);
    return () => window.removeEventListener('auth:required', handleAuthRequired);
  }, [logout]);

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-primary overflow-hidden">
      <TopNav
        onOpenProfile={() => setProfileOpen(true)}
        onOpenNotificationCenter={() => setNotificationOpen(true)}
        onOpenAlertPref={() => setAlertPrefOpen(true)}
      />
      <IndexBar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <BottomNews />

      {/* 全局弹窗/抽屉 */}
      <NotificationCenter
        open={notificationOpen}
        onClose={() => setNotificationOpen(false)}
      />
      <ProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onOpenAlertPref={() => setAlertPrefOpen(true)}
        onOpenNotificationCenter={() => setNotificationOpen(true)}
      />
      <AlertPreferenceDialog
        open={alertPrefOpen}
        onClose={() => setAlertPrefOpen(false)}
      />
      <LoginDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
      />
    </div>
  );
}
