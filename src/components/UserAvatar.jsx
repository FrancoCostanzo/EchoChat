import { Avatar } from '@heroui/react';

const STATUS_COLORS = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-danger',
  dnd: 'bg-danger',
  offline: 'bg-default-300',
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
      <Avatar
        name={initials}
        src={user?.avatar_url}
        size={size}
        className="bg-primary/10 text-primary"
      />
      {showStatus && user?.presence && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${STATUS_COLORS[user.presence] || STATUS_COLORS.offline}`}
        />
      )}
    </div>
  );
}
