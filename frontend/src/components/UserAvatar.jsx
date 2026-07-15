import { Avatar } from '@heroui/react';

const STATUS_COLORS = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-danger',
  dnd: 'bg-danger',
  offline: 'bg-default',
};

const SIZE_CLASS = {
  xs: 'size-6',
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
};

export default function UserAvatar({ user, size = 'md', showStatus = false, className = '' }) {
  const initials = (user?.display_name || user?.username || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md;

  return (
    <div className={`relative inline-flex shrink-0 ${sizeClass} ${className}`.trim()}>
      <Avatar
        size={size === 'xs' ? 'sm' : size}
        className={`${sizeClass} rounded-full! overflow-hidden`}
      >
        {user?.avatar_url && (
          <Avatar.Image
            src={user.avatar_url}
            alt={user?.display_name || ''}
            className="size-full! rounded-full object-cover object-center"
          />
        )}
        <Avatar.Fallback className="rounded-full">{initials}</Avatar.Fallback>
      </Avatar>
      {showStatus && user?.presence && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${STATUS_COLORS[user.presence] || STATUS_COLORS.offline}`}
        />
      )}
    </div>
  );
}
