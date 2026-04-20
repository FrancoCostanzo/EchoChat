import { Avatar } from '@heroui/react';

const STATUS_COLORS = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-danger',
  dnd: 'bg-danger',
  offline: 'bg-default',
};

export default function UserAvatar({ user, size = 'md', showStatus = false, className = '' }) {
  const initials = (user?.display_name || user?.username || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`relative inline-flex ${className}`}>
      <Avatar size={size}>
        {user?.avatar_url && <Avatar.Image src={user.avatar_url} alt={user?.display_name || ''} />}
        <Avatar.Fallback delayMs={0}>{initials}</Avatar.Fallback>
      </Avatar>
      {showStatus && user?.presence && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${STATUS_COLORS[user.presence] || STATUS_COLORS.offline}`}
        />
      )}
    </div>
  );
}
