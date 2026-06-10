import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';

const TimingPage = lazy(() => import('../pages/timing/TimingPage'));
const PerformancePage = lazy(() => import('../pages/performance/PerformancePage'));
const SignalsPage = lazy(() => import('../pages/signals/SignalsPage'));
const StrategyPage = lazy(() => import('../pages/strategy/StrategyPage'));
const SectorsPage = lazy(() => import('../pages/sectors/SectorsPage'));
const StocksPage = lazy(() => import('../pages/stocks/StocksPage'));
const WatchlistPage = lazy(() => import('../pages/watchlist/WatchlistPage'));
const NewsPage = lazy(() => import('../pages/news/NewsPage'));
const MembershipPage = lazy(() => import('../pages/membership/MembershipPage'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full bg-bg-primary text-text-muted text-sm">
      页面加载中...
    </div>
  );
}

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/timing" replace />} />
          {/* 公开页面：无需认证即可访问 */}
          <Route path="/timing" element={<TimingPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/strategy" element={<StrategyPage />} />
          <Route path="/sectors" element={<SectorsPage />} />
          <Route path="/stocks" element={<StocksPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/membership" element={<MembershipPage />} />

          {/* 受保护页面：需要认证才能访问 */}
          <Route
            path="/signals"
            element={<ProtectedRoute><SignalsPage /></ProtectedRoute>}
          />
          <Route
            path="/watchlist"
            element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>}
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
