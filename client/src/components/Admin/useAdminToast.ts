import { useCallback } from 'react';
import { useToastContext } from '@librechat/client';
import { NotificationSeverity } from '~/common';

export function useAdminToast() {
  const { showToast } = useToastContext();

  const showSuccess = useCallback(
    (message: string) => {
      showToast({ message, severity: NotificationSeverity.SUCCESS, duration: 3000 });
    },
    [showToast],
  );

  const showError = useCallback(
    (message: string) => {
      showToast({ message, severity: NotificationSeverity.ERROR, duration: 5000 });
    },
    [showToast],
  );

  return { showSuccess, showError };
}
