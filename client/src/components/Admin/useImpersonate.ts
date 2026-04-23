import { useCallback } from 'react';
import { dataService, setTokenHeader } from 'librechat-data-provider';

const IMPERSONATE_KEY = 'admin_impersonate_return';

export function useImpersonate() {
  const impersonate = useCallback(async (userId: string) => {
    localStorage.setItem(IMPERSONATE_KEY, 'true');

    const result = await dataService.impersonateAdminUser(userId);
    setTokenHeader(result.token);

    window.location.href = '/c/new';
  }, []);

  return { impersonate };
}

export function isImpersonating(): boolean {
  return localStorage.getItem(IMPERSONATE_KEY) === 'true';
}

export function endImpersonation() {
  localStorage.removeItem(IMPERSONATE_KEY);

  dataService.returnFromImpersonation().then((result) => {
    setTokenHeader(result.token);
    window.location.href = '/admin/users';
  }).catch(() => {
    window.location.href = '/login';
  });
}
