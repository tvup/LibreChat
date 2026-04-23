import React from 'react';
import DisplayUsernameMessages from './DisplayUsernameMessages';
import PreferredName from './PreferredName';
import LinkedAccounts from './LinkedAccounts';
import DeleteAccount from './DeleteAccount';
import Avatar from './Avatar';
import EnableTwoFactorItem from './TwoFactorAuthentication';
import BackupCodesItem from './BackupCodesItem';
import { useGetStartupConfig } from '~/data-provider';
import { useAuthContext } from '~/hooks';

function Account() {
  const { user } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();

  return (
    <div className="flex flex-col gap-3 p-1 text-sm text-text-primary">
      <div className="pb-3">
        <DisplayUsernameMessages />
      </div>
      <div className="pb-3">
        <Avatar />
      </div>
      <div className="pb-3">
        <PreferredName />
      </div>
      <div className="pb-3">
        <LinkedAccounts />
      </div>
      {user?.provider === 'local' && (
        <>
          <div className="pb-3">
            <EnableTwoFactorItem />
          </div>
          {user?.twoFactorEnabled && (
            <div className="pb-3">
              <BackupCodesItem />
            </div>
          )}
        </>
      )}
      {startupConfig?.allowAccountDeletion !== false && (
        <div className="pb-3">
          <DeleteAccount />
        </div>
      )}
    </div>
  );
}

export default React.memo(Account);
