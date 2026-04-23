import React from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { isImpersonating, endImpersonation } from './useImpersonate';
import { useAuthContext } from '~/hooks/AuthContext';

export default function ImpersonationBanner() {
  const { user, isAuthenticated } = useAuthContext();

  if (!isAuthenticated || !isImpersonating()) {
    return null;
  }

  return (
    <div className="relative z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-black">
      <ShieldAlert className="size-4" />
      <span>
        Impersonating: <strong>{user?.name || user?.email || 'Unknown user'}</strong>
      </span>
      <button
        onClick={endImpersonation}
        className="ml-2 inline-flex items-center gap-1 rounded-md bg-black/20 px-3 py-1 text-xs font-semibold text-black transition-colors hover:bg-black/30"
      >
        <ArrowLeft className="size-3" />
        Return to Admin
      </button>
    </div>
  );
}
