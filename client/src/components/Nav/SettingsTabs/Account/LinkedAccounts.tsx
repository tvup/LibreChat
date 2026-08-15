import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from 'librechat-data-provider';
import { Link2, Unlink } from 'lucide-react';
import { useLocalize } from '~/hooks';

interface LinkedProvider {
  provider: string;
  linked: boolean;
}

interface LinkedAccountsResponse {
  providers: LinkedProvider[];
  primaryProvider: string;
}

const providerLabels: Record<string, string> = {
  local: 'Email & Password',
  google: 'Google',
  github: 'GitHub',
  discord: 'Discord',
  facebook: 'Facebook',
  apple: 'Apple',
  openid: 'OpenID',
  saml: 'SAML',
  ldap: 'LDAP',
};

const providerColors: Record<string, string> = {
  local: 'bg-gray-500',
  google: 'bg-red-500',
  github: 'bg-gray-800',
  discord: 'bg-indigo-500',
  facebook: 'bg-blue-600',
  apple: 'bg-gray-900',
  openid: 'bg-orange-500',
  saml: 'bg-teal-500',
  ldap: 'bg-yellow-600',
};

export default function LinkedAccounts() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery<LinkedAccountsResponse>(
    ['linkedAccounts'],
    () => request.get('/api/user/linked-accounts'),
    { refetchOnWindowFocus: false },
  );

  const unlinkMutation = useMutation(
    (provider: string) => request.delete(`/api/user/linked-accounts/${provider}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['linkedAccounts']);
        setUnlinkTarget(null);
      },
    },
  );

  if (isLoading) {
    return (
      <div className="border-b border-border-medium pb-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Link2 className="size-4" />
          {localize('com_nav_linked_accounts')}
        </div>
        <div className="h-12 animate-pulse rounded bg-surface-hover" />
      </div>
    );
  }

  const providers = data?.providers ?? [];
  const primaryProvider = data?.primaryProvider ?? 'local';

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border-medium pb-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Link2 className="size-4" />
        {localize('com_nav_linked_accounts')}
      </div>
      <div className="space-y-2">
        {providers.map(({ provider }) => {
          const isPrimary = provider === primaryProvider;
          const label = providerLabels[provider] ?? provider;
          const colorClass = providerColors[provider] ?? 'bg-gray-500';

          return (
            <div
              key={provider}
              className="flex items-center justify-between rounded-lg border border-border-light bg-surface-secondary px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <div className={`size-2.5 rounded-full ${colorClass}`} />
                <span className="text-sm text-text-primary">{label}</span>
                {isPrimary && (
                  <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-500">
                    Primary
                  </span>
                )}
              </div>
              {!isPrimary && provider !== 'local' && (
                <button
                  onClick={() => setUnlinkTarget(provider)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-500/10"
                  title={`Unlink ${label}`}
                >
                  <Unlink className="size-3" />
                  Unlink
                </button>
              )}
            </div>
          );
        })}
      </div>

      {unlinkTarget && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border-light bg-surface-primary p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-text-primary">
              Unlink {providerLabels[unlinkTarget] ?? unlinkTarget}?
            </h3>
            <p className="mb-4 text-sm text-text-secondary">
              You will no longer be able to log in with this provider. Make sure you have another way to access your account.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setUnlinkTarget(null)}
                className="rounded-lg border border-border-light px-4 py-2 text-sm text-text-primary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                onClick={() => unlinkMutation.mutate(unlinkTarget)}
                disabled={unlinkMutation.isLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {unlinkMutation.isLoading ? 'Unlinking...' : 'Unlink'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
