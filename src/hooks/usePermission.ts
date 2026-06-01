import { useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import type { PlanLevel } from '../types';

/** 权限等级映射 */
const PLAN_LEVELS: Record<PlanLevel, number> = {
  free: 0,
  pro: 1,
  flagship: 2,
};

interface UsePermissionReturn {
  currentPlan: PlanLevel;
  canView: (requiredPlan: PlanLevel) => boolean;
  canOperate: (requiredPlan: PlanLevel) => boolean;
  checkAccess: (requiredPlan: PlanLevel) => { allowed: boolean; upgradeNeeded: boolean };
}

/**
 * 权限检查 Hook
 *
 * 用法：
 * ```tsx
 * const { canView, canOperate, checkAccess } = usePermission();
 * if (!canView('pro')) { showUpgradeModal(); }
 * ```
 */
export function usePermission(): UsePermissionReturn {
  const user = useAuthStore((s) => s.user);

  const currentPlan: PlanLevel = user?.plan || 'free';

  const canView = useCallback(
    (requiredPlan: PlanLevel): boolean => {
      return PLAN_LEVELS[currentPlan] >= PLAN_LEVELS[requiredPlan];
    },
    [currentPlan]
  );

  const canOperate = useCallback(
    (requiredPlan: PlanLevel): boolean => {
      return PLAN_LEVELS[currentPlan] >= PLAN_LEVELS[requiredPlan];
    },
    [currentPlan]
  );

  const checkAccess = useCallback(
    (requiredPlan: PlanLevel) => {
      const allowed = PLAN_LEVELS[currentPlan] >= PLAN_LEVELS[requiredPlan];
      return { allowed, upgradeNeeded: !allowed };
    },
    [currentPlan]
  );

  return { currentPlan, canView, canOperate, checkAccess };
}
