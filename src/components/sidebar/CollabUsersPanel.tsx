import { useCollabStore } from '../../stores/collab-store';

export function CollabUsersPanel() {
  const users = useCollabStore((s) => s.users);
  const userName = useCollabStore((s) => s.userName);
  const userColor = useCollabStore((s) => s.userColor);

  const userList = Array.from(users.values());

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--ctp-accent)' }}
      >
        Collaborators
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {/* Current user */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs">
          <span
            className="rounded-full shrink-0"
            style={{ width: 8, height: 8, backgroundColor: userColor || '#89b4fa' }}
          />
          <span style={{ color: 'var(--ctp-text)' }} className="truncate">
            {userName} (you)
          </span>
        </div>

        {/* Other users */}
        {userList.map((user, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs">
            <span
              className="rounded-full shrink-0"
              style={{ width: 8, height: 8, backgroundColor: user.color }}
            />
            <div className="flex flex-col min-w-0">
              <span style={{ color: 'var(--ctp-text)' }} className="truncate">
                {user.name}
              </span>
              {user.activeFile && (
                <span
                  className="truncate"
                  style={{ color: 'var(--ctp-overlay0)', fontSize: '0.6rem' }}
                >
                  {user.activeFile.split('/').pop()}
                </span>
              )}
            </div>
          </div>
        ))}

        {userList.length === 0 && (
          <div
            className="px-2 py-4 text-xs text-center"
            style={{ color: 'var(--ctp-overlay0)' }}
          >
            No other collaborators connected
          </div>
        )}
      </div>
    </div>
  );
}
