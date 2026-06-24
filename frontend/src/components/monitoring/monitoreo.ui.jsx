import { Card, Chip, Tooltip } from '@heroui/react';
import { Info } from 'lucide-react';
import monitoreoServices from '@/services/monitoring/monitoring.service';
import {
  getStatusColor,
  parseHttpRoute,
  getHttpMethodColor,
  STATUS_BG_CLASSES,
  STATUS_TEXT_CLASSES,
} from './monitoreo.helpers';

export const InfoTooltip = ({ content, placement = 'top' }) => {
  if (!content) return null;
  return (
    <Tooltip delay={300} closeDelay={100}>
      <Tooltip.Trigger
        aria-label="Más información"
        className="inline-flex cursor-help align-middle"
      >
        <Info className="w-3.5 h-3.5 text-default-400 hover:text-default-600 transition-colors" />
      </Tooltip.Trigger>
      <Tooltip.Content showArrow placement={placement}>
        <Tooltip.Arrow />
        <div className="max-w-72 px-1 py-0.5 text-xs leading-relaxed whitespace-pre-line">
          {content}
        </div>
      </Tooltip.Content>
    </Tooltip>
  );
};

export const LabelWithTooltip = ({ label, tooltip, className = '' }) => (
  <span className={`inline-flex items-center gap-1 ${className}`}>
    {label}
    {tooltip && <InfoTooltip content={tooltip} />}
  </span>
);

export const QuickStatCard = ({ label, icon, tooltip }) => {
  const IconEl = icon;
  return (
    <div className="flex items-center gap-2 mb-2">
      {IconEl && <IconEl className="w-4 h-4 text-primary shrink-0" />}
      <LabelWithTooltip label={label} tooltip={tooltip} className="text-xs text-default-600" />
    </div>
  );
};

export const StatBlock = ({ label, value, unit, tooltip, className = '' }) => (
  <div className={`flex flex-col gap-2 rounded-large bg-default-50 dark:bg-default-100/5 p-4 ${className}`}>
    <LabelWithTooltip
      label={label}
      tooltip={tooltip}
      className="text-xs font-medium text-default-500 uppercase tracking-wide"
    />
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-bold tabular-nums text-foreground">{value ?? 'N/A'}</span>
      {unit && <span className="text-sm font-medium text-default-500">{unit}</span>}
    </div>
  </div>
);

export const MetricItem = ({ label, value, unit, icon, progress = null, subtext = null, tooltip = null }) => {
  const IconEl = icon;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 text-default-600">
          {IconEl && <IconEl className="w-4 h-4 shrink-0" />}
          <LabelWithTooltip label={label} tooltip={tooltip} className="text-sm font-medium" />
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-foreground">{value ?? 'N/A'}</span>
          {unit && <span className="text-xs text-default-500 ml-1">{unit}</span>}
        </div>
      </div>
      {progress !== null && (
        <div className="w-full bg-default-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${
              progress > 90 ? 'bg-danger' : progress > 75 ? 'bg-warning' : 'bg-success'
            }`}
            style={{ width: `${Math.min(100, progress)}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label}: ${progress}%`}
          />
        </div>
      )}
      {subtext && <span className="text-xs text-default-400 text-right">{subtext}</span>}
    </div>
  );
};

export const TableColumnHeader = ({ label, tooltip }) => (
  <span className="inline-flex items-center gap-1">
    {label}
    {tooltip && <InfoTooltip content={tooltip} placement="top" />}
  </span>
);

export const HttpRouteLabel = ({ route }) => {
  const { method, path } = parseHttpRoute(route);
  return (
    <span className="inline-flex items-center gap-2 min-w-0 max-w-full">
      {method && (
        <Chip
          size="sm"
          variant="flat"
          color={getHttpMethodColor(method)}
          classNames={{
            base: 'h-5 min-w-0 px-1.5',
            content: 'font-mono text-[10px] font-bold px-0',
          }}
        >
          {method}
        </Chip>
      )}
      <span className="font-mono text-xs truncate text-default-700">{path}</span>
    </span>
  );
};

export const StatusCard = ({ title, status, icon, children, tooltip = null }) => {
  const IconEl = icon;
  const color = getStatusColor(status);
  const bgClass = STATUS_BG_CLASSES[color] || STATUS_BG_CLASSES.default;
  const textClass = STATUS_TEXT_CLASSES[color] || STATUS_TEXT_CLASSES.default;

  return (
    <Card className="h-full">
      <Card.Header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg shrink-0 ${bgClass}`}>
            <IconEl className={`w-5 h-5 ${textClass}`} />
          </div>
          <LabelWithTooltip label={title} tooltip={tooltip} className="font-semibold text-foreground" />
        </div>
        {status && (
          <Chip color={color} variant="flat" size="sm" className="capitalize shrink-0">
            {monitoreoServices.getStatusLabel(status)}
          </Chip>
        )}
      </Card.Header>
      <hr className="border-divider" />
      <Card.Content className="flex flex-col gap-4">
        {children}
      </Card.Content>
    </Card>
  );
};
