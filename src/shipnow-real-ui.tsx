import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Menu } from 'lucide-react';

export function MobilePageSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`sn-mobile-page ${className ?? ''}`.trim()}>{children}</div>;
}

export function MobileCompactHeader({
  title,
  onMenu,
  className,
}: {
  title: ReactNode;
  onMenu: () => void;
  className?: string;
}) {
  return (
    <div className={`sn-mobile-page-header ${className ?? ''}`.trim()}>
      <MobileIconButton type="button" aria-label="菜单" onClick={onMenu}>
        <Menu className="size-4" />
      </MobileIconButton>
      <div className="sn-mobile-brand">{title}</div>
    </div>
  );
}

export function MobileTopBar({
  left,
  title,
  right,
  className,
}: {
  left?: ReactNode;
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sn-mobile-topbar ${className ?? ''}`.trim()}>
      <div className="sn-mobile-topbar-left">{left}</div>
      <div className="sn-mobile-topbar-title">{title}</div>
      <div className="sn-mobile-topbar-right">{right}</div>
    </div>
  );
}

export function MobileIconButton({
  children,
  className,
  ...buttonProps
}: {
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`sn-mobile-icon-button ${className ?? ''}`.trim()} {...buttonProps}>{children}</button>;
}

export function MobileStatusPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`sn-mobile-status-pill ${className ?? ''}`.trim()}>{children}</div>;
}

export function MobileActionButton({
  children,
  variant = 'secondary',
  className,
  ...buttonProps
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantClass = variant === 'primary' ? 'is-primary' : variant === 'ghost' ? 'is-ghost' : 'is-secondary';
  return <button className={`sn-mobile-action-button ${variantClass} ${className ?? ''}`.trim()} {...buttonProps}>{children}</button>;
}
