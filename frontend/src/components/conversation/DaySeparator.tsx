import { formatDaySeparator } from '@/lib/dates';

// Centered date chip inserted between messages whenever the calendar day changes.
export default function DaySeparator({ date }: { date: string | null | undefined }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-ink-800/80 px-3 py-1 text-[11px] font-medium text-ink-100 shadow-sm backdrop-blur-sm">
        {formatDaySeparator(date)}
      </span>
    </div>
  );
}
