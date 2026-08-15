import React, { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, request } from 'librechat-data-provider';
import { Label } from '@librechat/client';
import { useAuthContext, useLocalize } from '~/hooks';

export default function PreferredName() {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const nameParts = useMemo(() => {
    if (!user?.name) {
      return [];
    }
    return user.name.split(/\s+/).filter(Boolean);
  }, [user?.name]);

  const currentPreferred = user?.preferredName;

  const mutation = useMutation(
    (preferredName: string) =>
      request.patch('/api/user/preferred-name', { preferredName }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.user]);
      },
    },
  );

  if (nameParts.length <= 1) {
    return null;
  }

  return (
    <div className="border-b border-border-medium pb-3">
      <Label className="mb-2 block">{localize('com_nav_preferred_name')}</Label>
      <p className="mb-3 text-xs text-text-secondary">
        {localize('com_nav_preferred_name_info')}
      </p>
      <div className="flex flex-wrap gap-2">
        {nameParts.map((part) => {
          const isSelected = currentPreferred === part;
          return (
            <button
              key={part}
              onClick={() => mutation.mutate(isSelected ? '' : part)}
              disabled={mutation.isLoading}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                isSelected
                  ? 'border-green-500 bg-green-500/10 text-green-500 underline decoration-2 underline-offset-2'
                  : 'border-border-light bg-surface-secondary text-text-primary hover:border-border-heavy hover:bg-surface-hover'
              }`}
            >
              {part}
            </button>
          );
        })}
      </div>
      {currentPreferred && (
        <p className="mt-2 text-xs text-text-secondary">
          {localize('com_nav_preferred_name_current')}: <span className="font-medium underline">{currentPreferred}</span>
        </p>
      )}
    </div>
  );
}
