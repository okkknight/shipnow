import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  Folder,
  Home,
  LayoutGrid,
  Link2,
  Menu,
  Paperclip,
  Plus,
  MoreVertical,
  Search,
  Send,
  Settings2,
  Sparkles,
  RefreshCcw,
  Trash2,
  Upload,
  WandSparkles,
  MoreHorizontal,
  AlertTriangle,
  User,
  X,
  Zap,
} from 'lucide-react';
import { RichTextMessage } from './messageFormatting';

export type Tone = 'preview-ready' | 'published' | 'building' | 'needs-fix';

type SnButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon';

export function SnButton({
  children,
  variant = 'secondary',
  icon,
  title,
  className,
  type = 'button',
  ...buttonProps
}: {
  children?: ReactNode;
  variant?: SnButtonVariant;
  icon?: ReactNode;
  title?: string;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantClass =
    variant === 'primary'
      ? 'sn-button-primary'
      : variant === 'secondary'
        ? 'sn-button-secondary'
        : variant === 'ghost'
          ? 'sn-button-ghost'
          : variant === 'destructive'
            ? 'sn-button-destructive'
            : 'sn-button-icon';

  return (
    <button type={type} className={`sn-button ${variantClass} ${className ?? ''}`.trim()} title={title} {...buttonProps}>
      {icon ? <span className="sn-button-icon-slot">{icon}</span> : null}
      {children}
    </button>
  );
}

export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`sn-status-chip ${tone}`}>{children}</span>;
}

export function QuickActionChip({
  children,
  icon,
  className,
  type = 'button',
  ...buttonProps
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`sn-quick-chip ${className ?? ''}`.trim()} {...buttonProps}>
      {icon ? <span className="sn-quick-chip-icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

export function TopBar({
  mode,
}: {
  mode: 'workspace' | 'project' | 'preview';
}) {
  return (
    <div className="sn-topbar">
      {mode === 'workspace' ? (
        <>
          <div className="sn-topbar-left">
            <SnButton variant="icon" icon={<Menu className="size-4" />} title="打开菜单" />
            <div className="sn-brand-stack">
              <div className="sn-brand-mark">SN</div>
              <div>
                <div className="sn-brand-title">ShipNow</div>
                <div className="sn-brand-subtitle">主工作台顶部栏</div>
              </div>
            </div>
          </div>
          <div className="sn-topbar-right">
            <StatusChip tone="preview-ready">Preview ready</StatusChip>
            <SnButton variant="icon" className="sn-button-icon-dark" icon={<Plus className="size-4" />} title="新建项目" />
          </div>
        </>
      ) : null}

      {mode === 'project' ? (
        <>
          <div className="sn-topbar-left">
            <SnButton variant="icon" icon={<ChevronLeft className="size-4" />} title="返回" />
            <div className="sn-brand-stack">
              <div className="sn-brand-mark sn-brand-mark--compact">SN</div>
              <div>
                <div className="sn-brand-title sn-brand-title-inline">
                  <span>bannercheck</span>
                  <Edit2 className="size-3" />
                </div>
                <div className="sn-brand-subtitle">Marketing banner site</div>
              </div>
            </div>
          </div>
          <div className="sn-topbar-right">
            <SnButton variant="icon" icon={<MoreHorizontal className="size-4" />} title="更多" />
          </div>
        </>
      ) : null}

      {mode === 'preview' ? (
        <>
          <div className="sn-topbar-left">
            <SnButton variant="icon" icon={<X className="size-4" />} title="关闭" />
            <div className="sn-brand-stack">
              <div className="sn-brand-mark sn-brand-mark--compact">SN</div>
              <div>
                <div className="sn-brand-title sn-brand-title-inline">Preview - v1 · Home</div>
                <div className="sn-brand-subtitle">预览页顶部栏</div>
              </div>
            </div>
          </div>
          <div className="sn-topbar-right">
            <SnButton variant="icon" icon={<ArrowUpRight className="size-4" />} title="分享" />
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ChatBubble({
  role,
  children,
  className,
}: {
  role: 'user' | 'assistant' | 'thinking' | 'system';
  children: ReactNode;
  className?: string;
}) {
  const roleClass =
    role === 'user'
      ? 'user'
      : role === 'assistant'
        ? 'assistant'
        : role === 'system'
          ? 'system'
          : 'thinking';

  return (
    <div className={`sn-chat-bubble ${roleClass} ${className ?? ''}`.trim()}>
      {role === 'assistant' ? (
        <div className="sn-chat-avatar is-assistant" aria-hidden="true">
          <Sparkles className="size-4" />
        </div>
      ) : null}
      {role === 'system' ? (
        <div className="sn-chat-avatar is-system" aria-hidden="true">
          <Sparkles className="size-4" />
        </div>
      ) : null}
      {role === 'user' ? (
        <div className="sn-chat-avatar is-user" aria-hidden="true">
          <User className="size-4" />
        </div>
      ) : null}
      <div className="sn-chat-copy">{typeof children === 'string' ? <RichTextMessage content={children} /> : children}</div>
    </div>
  );
}

export function AssistantActionCard({
  title,
  summary,
}: {
  title: string;
  summary: string;
}) {
  return (
    <article className="sn-action-card">
      <div className="sn-action-visual">
        <div className="sn-action-thumb">
          <div className="sn-action-mini">
            <div className="sn-action-mini-top" />
            <div className="sn-action-mini-content">
              <div className="sn-action-mini-line sn-action-mini-line-lg" />
              <div className="sn-action-mini-line" />
              <div className="sn-action-mini-line sn-action-mini-line-sm" />
              <div className="sn-action-mini-pill" />
            </div>
          </div>
        </div>
        <div className="sn-action-side">
          <div className="sn-action-title">{title}</div>
          <ul className="sn-action-checklist">
            <li><CheckCircle2 className="size-4" /> Hero 区域</li>
            <li><CheckCircle2 className="size-4" /> 核心优势</li>
            <li><CheckCircle2 className="size-4" /> 操作指引</li>
          </ul>
          <div className="sn-action-section-count">4 sections</div>
        </div>
      </div>
      <div className="sn-action-body">
        <p className="sn-action-summary">{summary}</p>
        <div className="sn-action-cta-row">
          <SnButton variant="secondary" icon={<Eye className="size-4" />}>
            Open preview
          </SnButton>
          <SnButton variant="primary" icon={<ArrowUpRight className="size-4" />}>
            Publish
          </SnButton>
          <SnButton variant="ghost" icon={<Sparkles className="size-4" />}>
            Continue editing
          </SnButton>
        </div>
      </div>
    </article>
  );
}

export function ProjectCard({
  name,
  description,
  status,
  updatedAt,
  onClick,
}: {
  name: string;
  description: string;
  status: Tone;
  updatedAt: string;
  onClick?: () => void;
}) {
  return (
    <article
      className={`sn-project-card ${onClick ? 'is-clickable' : ''}`.trim()}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
    >
      <div className="sn-project-thumb">
        <div className="sn-project-thumb-inner" />
      </div>
      <div className="sn-project-copy">
        <div className="sn-project-head">
          <div>
            <h3 className="sn-project-name">{name}</h3>
            <p className="sn-project-description">{description}</p>
          </div>
          <SnButton variant="icon" icon={<MoreHorizontal className="size-4" />} title="更多操作" />
        </div>
        <div className="sn-project-meta">
          <span className="sn-project-avatar" />
          <StatusChip tone={status}>
            {status === 'preview-ready'
              ? 'Preview ready'
              : status === 'published'
                ? 'Published'
                : status === 'building'
                  ? 'Building'
                  : 'Needs fix'}
          </StatusChip>
          <span>{updatedAt}</span>
        </div>
      </div>
    </article>
  );
}

export function Composer() {
  return (
    <div className="sn-composer">
      <div className="sn-composer-rail">
        <SnButton variant="icon" className="sn-composer-icon" icon={<Paperclip className="size-4" />} title="附件" />
        <input
          className="sn-composer-input"
          type="text"
          placeholder="告诉 ShipNow 你想做什么..."
          readOnly
        />
        <SnButton variant="icon" className="sn-send-button" icon={<Send className="size-4" />} title="发送" />
      </div>
      <div className="sn-composer-actions">
        <SnButton variant="secondary" className="sn-preview-button" icon={<Eye className="size-4" />}>
          Preview
        </SnButton>
        <SnButton variant="secondary" className="sn-publish-button" icon={<Upload className="size-4" />}>
          Publish
        </SnButton>
      </div>
    </div>
  );
}

export function DrawerMock({
  side,
  title,
  children,
}: {
  side: 'left' | 'right';
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`sn-drawer ${side}`}>
      <div className="sn-drawer-head">
        <div>
          <p className="sn-drawer-kicker">{side === 'left' ? 'Navigation' : 'Status'}</p>
          <h3 className="sn-drawer-title">{title}</h3>
        </div>
        <SnButton variant="icon" icon={<ChevronDown className="size-4" />} title="折叠" />
      </div>
      <div className="sn-drawer-body">{children}</div>
    </div>
  );
}

export function ConfirmationSheet({
  title,
  description,
  confirmLabel,
  destructive = false,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
}) {
  return (
    <div className="sn-confirmation-sheet">
      <div className="sn-confirmation-head">
        <div className="sn-confirmation-badge">{destructive ? 'Delete confirmation' : 'Publish confirmation'}</div>
        <div className="sn-confirmation-title">{title}</div>
        <p className="sn-confirmation-description">{description}</p>
      </div>
      <div className="sn-confirmation-footer">
        <SnButton variant="secondary">Cancel</SnButton>
        <SnButton variant={destructive ? 'destructive' : 'primary'}>{confirmLabel}</SnButton>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="sn-empty-state">
      <div className="sn-empty-icon">{icon}</div>
      <div className="sn-empty-title">{title}</div>
      <p className="sn-empty-description">{description}</p>
    </div>
  );
}
