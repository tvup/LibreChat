import React from 'react';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';

function ConfigRow({ label, value }: { label: string; value: string | boolean | undefined }) {
  const display =
    value === undefined
      ? '-'
      : typeof value === 'boolean'
        ? value
          ? 'Enabled'
          : 'Disabled'
        : String(value);

  return (
    <div className="flex items-center justify-between border-b border-border-light px-4 py-3 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span
        className={`text-sm font-medium ${
          value === true
            ? 'text-green-500'
            : value === false
              ? 'text-red-500'
              : 'text-text-primary'
        }`}
      >
        {display}
      </span>
    </div>
  );
}

export default function AdminSystemSettings() {
  const localize = useLocalize();
  const { data: config } = useGetStartupConfig();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {localize('com_admin_settings')}
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border-light bg-surface-secondary">
          <h2 className="border-b border-border-light px-4 py-3 text-lg font-medium text-text-primary">
            Authentication
          </h2>
          <ConfigRow label="Registration" value={config?.registrationEnabled} />
          <ConfigRow label="Social Login" value={config?.socialLoginEnabled} />
          <ConfigRow label="Email Login" value={config?.emailLoginEnabled} />
          <ConfigRow label="Password Reset" value={config?.passwordResetEnabled} />
          <ConfigRow label="Email Verification" value={config?.emailEnabled} />
        </div>

        <div className="rounded-xl border border-border-light bg-surface-secondary">
          <h2 className="border-b border-border-light px-4 py-3 text-lg font-medium text-text-primary">
            Features
          </h2>
          <ConfigRow label="Balance" value={config?.balance != null} />
          <ConfigRow label="App Title" value={config?.appTitle} />
          <ConfigRow label="Server Domain" value={config?.serverDomain} />
        </div>

        <div className="rounded-xl border border-border-light bg-surface-secondary">
          <h2 className="border-b border-border-light px-4 py-3 text-lg font-medium text-text-primary">
            Social Logins
          </h2>
          <ConfigRow label="Google" value={!!config?.googleLoginEnabled} />
          <ConfigRow label="Facebook" value={!!config?.facebookLoginEnabled} />
          <ConfigRow label="GitHub" value={!!config?.githubLoginEnabled} />
          <ConfigRow label="Discord" value={!!config?.discordLoginEnabled} />
          <ConfigRow label="Apple" value={!!config?.appleLoginEnabled} />
          <ConfigRow label="OpenID" value={!!config?.openidLoginEnabled} />
          <ConfigRow label="SAML" value={!!config?.samlLoginEnabled} />
        </div>
      </div>
    </div>
  );
}
