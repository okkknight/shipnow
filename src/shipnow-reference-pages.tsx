import { type ButtonHTMLAttributes, type ReactNode } from 'react';
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
  Info,
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
import type { Tone } from './shipnow-ui';
import {
  AssistantActionCard,
  ChatBubble,
  Composer,
  ConfirmationSheet,
  DrawerMock,
  EmptyState,
  ProjectCard,
  QuickActionChip,
  SnButton,
  StatusChip,
  TopBar,
} from './shipnow-ui';


export function ReferenceVisualPhoneShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sn-reference-phone ${className ?? ''}`.trim()}>
      <div className="sn-reference-phone-device">
        <div className="sn-reference-phone-screen">
          <div className="sn-reference-phone-statusbar">
            <span className="sn-reference-phone-time">9:41</span>
            <div className="sn-reference-phone-indicators" aria-hidden="true">
              <span className="sn-reference-phone-signal">
                <span />
                <span />
                <span />
                <span />
              </span>
              <span className="sn-reference-phone-wifi" />
              <span className="sn-reference-phone-battery">
                <span />
              </span>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ReferenceVisualPhoneTopBar({
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
    <div className={`sn-reference-phone-topbar ${className ?? ''}`.trim()}>
      <div className="sn-reference-phone-topbar-left">{left}</div>
      <div className="sn-reference-phone-topbar-title">{title}</div>
      <div className="sn-reference-phone-topbar-right">{right}</div>
    </div>
  );
}

export function SnActionButton({
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
  return <button className={`sn-action-button ${variantClass} ${className ?? ''}`.trim()} {...buttonProps}>{children}</button>;
}

function Section({
  index,
  label,
  title,
  description,
  className,
  children,
}: {
  index: number;
  label: string;
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`sn-panel sn-section ${className ?? ''}`.trim()}>
      <header className="sn-section-head">
        <div>
          <p className="sn-section-kicker">{`${index}. ${label}`}</p>
          <h2 className="sn-section-title">{title}</h2>
        </div>
        <p className="sn-section-description">{description}</p>
      </header>
      {children}
    </section>
  );
}

function DemoToken({ name, value, swatch }: { name: string; value: string; swatch: string }) {
  return (
    <div className="sn-token">
      <div className="sn-token-swatch" style={{ background: swatch }} />
      <div className="sn-token-meta">
        <div className="sn-token-name">{name}</div>
        <div className="sn-token-value">{value}</div>
      </div>
    </div>
  );
}

function DesignSystemHeader() {
  return (
    <header className="sn-ds-header">
      <div className="sn-ds-brand">
        <div className="sn-ds-logo">
          <Zap className="size-5" />
        </div>
        <div className="sn-ds-title-wrap">
          <div className="sn-ds-brand-name">ShipNow</div>
          <div className="sn-ds-brand-sub">
            <span>Component System</span>
            <span className="sn-ds-pill">v1.0</span>
          </div>
        </div>
      </div>
      <p className="sn-ds-description">
        Chat-first vibe coding & one-click auto-deploy for small static sites.
        <br />
        对话式开发与一键部署，专为静态站点而生。
      </p>
    </header>
  );
}

function IconTile({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="sn-icon-tile">
      <div className="sn-icon-tile-icon">{icon}</div>
      <div className="sn-icon-tile-label">{label}</div>
    </div>
  );
}

function TypographyRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={`sn-typography-row ${mono ? 'mono' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function NoteItem({ children }: { children: ReactNode }) {
  return (
    <div className="sn-note-item">
      <CheckCircle2 className="size-4" />
      <span>{children}</span>
    </div>
  );
}

const DESIGN_SYSTEM_TOKENS = [
  { name: '--sn-color-mint', value: '#B7F1DF', swatch: 'var(--sn-color-mint)' },
  { name: '--sn-color-sage', value: '#E8F5EF', swatch: 'var(--sn-color-sage)' },
  { name: '--sn-color-ivory', value: '#FAF7F3', swatch: 'var(--sn-color-ivory)' },
  { name: '--sn-color-stone', value: '#E7E5E1', swatch: 'var(--sn-color-stone)' },
  { name: '--sn-color-ink', value: '#0F1115', swatch: 'var(--sn-color-ink)' },
] as const;

function DrawerListItem({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="sn-drawer-list-item">
      <div className="sn-drawer-list-item-icon">{icon}</div>
      <div className="sn-drawer-list-item-copy">
        <div className="sn-drawer-list-item-title">{title}</div>
        <div className="sn-drawer-list-item-subtitle">{subtitle}</div>
      </div>
      <MoreHorizontal className="size-4 sn-drawer-list-item-more" />
    </div>
  );
}

function MobileDesignSystemPage() {
  const iconSamples = [
    { icon: <Menu className="size-4" />, label: 'Menu' },
    { icon: <Paperclip className="size-4" />, label: 'Attachment' },
    { icon: <Sparkles className="size-4" />, label: 'Sparkles' },
    { icon: <Eye className="size-4" />, label: 'Preview' },
    { icon: <Send className="size-4" />, label: 'Send' },
    { icon: <Check className="size-4" />, label: 'Check' },
    { icon: <Plus className="size-4" />, label: 'Plus' },
    { icon: <Upload className="size-4" />, label: 'Upload' },
    { icon: <Download className="size-4" />, label: 'Download' },
    { icon: <Trash2 className="size-4" />, label: 'Trash' },
    { icon: <MoreVertical className="size-4" />, label: 'More' },
    { icon: <Search className="size-4" />, label: 'Search' },
    { icon: <Settings2 className="size-4" />, label: 'Settings' },
    { icon: <AlertTriangle className="size-4" />, label: 'Warning' },
    { icon: <Info className="size-4" />, label: 'Info' },
    { icon: <User className="size-4" />, label: 'User' },
    { icon: <Folder className="size-4" />, label: 'Folder' },
    { icon: <Link2 className="size-4" />, label: 'Link' },
    { icon: <ArrowUpRight className="size-4" />, label: 'External' },
    { icon: <RefreshCcw className="size-4" />, label: 'Refresh' },
  ];

  return (
    <div className="sn-ds-mobile">
      <div className="sn-ds-mobile-hero">
        <div className="sn-ds-mobile-brand-row">
          <div className="sn-ds-mobile-mark">
            <Zap className="size-4" />
          </div>
          <div className="sn-ds-mobile-brand-copy">
            <div className="sn-ds-mobile-brand-name">ShipNow</div>
            <div className="sn-ds-mobile-brand-sub">Component System · v1.0</div>
          </div>
        </div>
        <div className="sn-ds-mobile-summary">
          <p>Chat-first vibe coding & one-click auto-deploy for small static sites.</p>
          <p>对话式开发与一键部署，专为静态站点而生。</p>
        </div>
        <div className="sn-ds-mobile-pills">
          <span>15 components</span>
          <span>touch-first</span>
          <span>mobile native</span>
        </div>
      </div>

      <Section index={1} label="BUTTONS 按钮" title="Button family" description="移动端里，每一种按钮都要有明确触点和间距。">
        <div className="sn-ds-mobile-button-stack">
          <div className="sn-ds-mobile-button-row">
            <div className="sn-ds-mobile-button-label">
              <span>Primary</span>
              <small>主要</small>
            </div>
            <div className="sn-ds-mobile-button-controls">
              <SnButton variant="primary" className="sn-ds-mobile-full-button">Primary Button</SnButton>
              <SnButton variant="icon" icon={<Plus className="size-4" />} title="Add" />
            </div>
          </div>
          <div className="sn-ds-mobile-button-row">
            <div className="sn-ds-mobile-button-label">
              <span>Secondary</span>
              <small>次要</small>
            </div>
            <div className="sn-ds-mobile-button-controls">
              <SnButton variant="secondary" className="sn-ds-mobile-full-button">Secondary Button</SnButton>
              <SnButton variant="icon" icon={<Plus className="size-4" />} title="Add" />
            </div>
          </div>
          <div className="sn-ds-mobile-button-row">
            <div className="sn-ds-mobile-button-label">
              <span>Ghost</span>
              <small>幽灵</small>
            </div>
            <div className="sn-ds-mobile-button-controls">
              <SnButton variant="ghost" className="sn-ds-mobile-full-button">Ghost Button</SnButton>
              <SnButton variant="icon" icon={<Plus className="size-4" />} title="Add" />
            </div>
          </div>
          <div className="sn-ds-mobile-button-row">
            <div className="sn-ds-mobile-button-label">
              <span>Destructive</span>
              <small>危险</small>
            </div>
            <div className="sn-ds-mobile-button-controls">
              <SnButton variant="destructive" className="sn-ds-mobile-full-button">Delete</SnButton>
              <SnButton variant="icon" icon={<Trash2 className="size-4" />} title="Delete" />
            </div>
          </div>
        </div>
      </Section>

      <Section index={2} label="STATUS & QUICK CHIPS 状态与快捷芯片" title="Status chips" description="在手机上，状态和动作要分成两组，避免挤在一起。">
        <div className="sn-ds-mobile-chip-group">
          <div className="sn-ds-mobile-chip-row status">
            <StatusChip tone="preview-ready">Preview ready</StatusChip>
            <StatusChip tone="published">Published</StatusChip>
            <StatusChip tone="building">Building</StatusChip>
            <StatusChip tone="needs-fix">Needs fix</StatusChip>
          </div>
          <div className="sn-ds-mobile-chip-row quick">
            <QuickActionChip icon={<Sparkles className="size-4" />}>优化文案</QuickActionChip>
            <QuickActionChip icon={<LayoutGrid className="size-4" />}>调整配色</QuickActionChip>
            <QuickActionChip icon={<Plus className="size-4" />}>增加页面</QuickActionChip>
            <QuickActionChip icon={<Upload className="size-4" />}>上传图片</QuickActionChip>
            <QuickActionChip icon={<CircleAlert className="size-4" />}>修复问题</QuickActionChip>
          </div>
        </div>
      </Section>

      <Section index={3} label="CHAT & COMPOSER 聊天与输入" title="Conversation flow" description="手机上更像独立对话页，而不是桌面工作台的缩窄版。">
        <div className="sn-chat-stack">
          <ChatBubble role="user">帮我创建一个产品宣传页，突出速度快、部署简单，风格要简洁高级。</ChatBubble>
          <ChatBubble role="assistant">好的！我为你生成了一个简洁高级的产品宣传页。</ChatBubble>
          <ChatBubble role="thinking">ShipNow 正在修改并重新构建预览…</ChatBubble>
        </div>
        <Composer />
      </Section>

      <Section index={4} label="SURFACES 界面构件" title="Surface cards" description="把助手卡、项目卡这些更重的结构放在一起看。">
        <AssistantActionCard
          title="v1 · Home"
          summary="把配色换成薄荷绿主色，并把首屏文案压缩成更直接的价值表达。"
        />
        <div className="sn-card-list sn-ds-mobile-stack">
          <ProjectCard
            name="bannercheck"
            description="Marketing banner site"
            status="preview-ready"
            updatedAt="Updated 12 minutes ago"
          />
          <ProjectCard
            name="loveadventure"
            description="Interactive campaign page"
            status="published"
            updatedAt="Updated 2 hours ago"
          />
        </div>
      </Section>

      <Section index={5} label="SYSTEM CHROME 系统壳" title="Top bars and drawers" description="把顶部栏和抽屉的层次拉开，避免和内容混在一起。">
        <div className="sn-topbar-stack sn-ds-mobile-stack">
          <div className="sn-topbar-preview">
            <TopBar mode="workspace" />
          </div>
          <div className="sn-topbar-preview">
            <TopBar mode="project" />
          </div>
          <div className="sn-topbar-preview">
            <TopBar mode="preview" />
          </div>
        </div>
        <div className="sn-ds-mobile-drawer-grid">
          <DrawerMock side="left" title="项目抽屉">
            <div className="sn-drawer-list">
              <DrawerListItem icon={<Folder className="size-4" />} title="Primary Button" subtitle="主操作按钮" />
              <DrawerListItem icon={<Plus className="size-4" />} title="Secondary Button" subtitle="次要按钮" />
            </div>
          </DrawerMock>
          <DrawerMock side="right" title="状态抽屉">
            <div className="sn-drawer-list">
              <div className="sn-drawer-metric">
                <span>预览地址</span>
                <strong>api.boringmax.com/shipnow/preview/bannercheck</strong>
              </div>
              <div className="sn-drawer-metric">
                <span>线上地址</span>
                <strong>boringmax.com/bannercheck</strong>
              </div>
            </div>
          </DrawerMock>
        </div>
      </Section>

      <Section index={6} label="TOKENS & TYPE 令牌与字体" title="Tokens and typography" description="移动端把信息收束成更适合扫读的单列。">
        <div className="sn-ds-mobile-token-block">
          <div className="sn-token-group-title">Color 颜色</div>
          <div className="sn-ds-mobile-token-grid">
            {DESIGN_SYSTEM_TOKENS.map((token) => (
              <DemoToken key={token.name} {...token} />
            ))}
          </div>
        </div>
        <div className="sn-ds-mobile-token-block">
          <div className="sn-token-group-title">Typography 字体系统</div>
          <div className="sn-typography-grid sn-ds-mobile-typography">
            <div className="sn-typography-mark">Aa</div>
            <div className="sn-typography-family">
              <div className="sn-font-list">
                <span>Plus Jakarta Sans</span>
                <span>Inter</span>
                <span>Fira Code</span>
              </div>
            </div>
            <div className="sn-typography-samples">
              <TypographyRow label="Heading / H1" value="32 / 40 · SemiBold" />
              <TypographyRow label="Body / Regular" value="14 / 22 · Regular" />
              <TypographyRow label="Caption" value="11 / 14 · Regular" />
            </div>
          </div>
        </div>
      </Section>

      <Section index={7} label="ICON SET & STATES 图标与状态" title="Icons and empty states" description="最后把图标和空态收口，确保整套语言一致。">
        <div className="sn-ds-mobile-icon-grid">
          {iconSamples.map((sample) => (
            <div key={sample.label} className="sn-icon-tile">
              <div className="sn-icon-tile-icon">{sample.icon}</div>
              <div className="sn-icon-tile-label">{sample.label}</div>
            </div>
          ))}
        </div>
        <div className="sn-ds-mobile-state-grid">
          <ConfirmationSheet
            title="确认发布到正式站点"
            description="ShipNow 会将当前预览复制到正式站点，并使用公开地址作为访问入口。"
            confirmLabel="Publish"
          />
          <EmptyState
            title="No projects yet"
            description="Start a conversation to build your first site."
            icon={<Plus className="size-6" />}
          />
        </div>
      </Section>
    </div>
  );
}

function ReferencePreviewPhone() {
  return (
    <ReferenceVisualPhoneShell className="is-hero">
      <ReferenceVisualPhoneTopBar
        left={<button className="sn-reference-phone-icon-button" type="button" aria-label="返回"><ChevronLeft className="size-5" /></button>}
        title="bannercheck"
        right={<button className="sn-reference-phone-pill" type="button">Publish</button>}
      />
      <div className="sn-reference-phone-body sn-reference-preview-phone">
        <div className="sn-reference-version">v1 · Home</div>
        <h3 className="sn-reference-headline">
          Ship faster.
          <br />
          Ship now.
        </h3>
        <p className="sn-reference-copy">
          ShipNow 帮助你以对话的方式创建和部署静态网站。输入想法，快速上线。
        </p>
        <div className="sn-reference-preview-actions">
          <SnActionButton variant="primary">Get started</SnActionButton>
          <SnActionButton>Learn more</SnActionButton>
        </div>
        <div className="sn-reference-illustration">
          <div className="sn-reference-illustration-backdrop" />
          <div className="sn-reference-illustration-card is-left">
            <div className="sn-reference-illustration-icon">↺</div>
          </div>
          <div className="sn-reference-illustration-card is-center">
            <div className="sn-reference-illustration-grid">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="sn-reference-illustration-card is-right">
            <div className="sn-reference-illustration-icon">◎</div>
          </div>
          <div className="sn-reference-illustration-badge" />
        </div>
        <div className="sn-reference-feature-grid">
          <div className="sn-reference-feature-card">
            <div className="sn-reference-feature-icon"><Sparkles className="size-4" /></div>
            <div className="sn-reference-feature-title">对话式创建</div>
            <div className="sn-reference-feature-desc">从描述里生成页面，AI 辅助快速成型。</div>
          </div>
          <div className="sn-reference-feature-card">
            <div className="sn-reference-feature-icon"><Eye className="size-4" /></div>
            <div className="sn-reference-feature-title">一键部署</div>
            <div className="sn-reference-feature-desc">自动构建并发布，全球可访问。</div>
          </div>
          <div className="sn-reference-feature-card">
            <div className="sn-reference-feature-icon"><Upload className="size-4" /></div>
            <div className="sn-reference-feature-title">持续迭代</div>
            <div className="sn-reference-feature-desc">每次修改都能快速上线。</div>
          </div>
        </div>
        <div className="sn-reference-footer-actions">
          <SnActionButton className="with-icon" variant="secondary"><Edit2 className="size-4" /> Continue editing</SnActionButton>
          <SnActionButton className="with-icon" variant="primary"><Upload className="size-4" /> Publish</SnActionButton>
        </div>
      </div>
    </ReferenceVisualPhoneShell>
  );
}

function ReferenceStatusPhone() {
  return (
    <ReferenceVisualPhoneShell className="is-compact">
      <ReferenceVisualPhoneTopBar
        left={<button className="sn-reference-phone-icon-button" type="button" aria-label="返回"><ChevronLeft className="size-5" /></button>}
        title="bannercheck"
        right={<div />}
      />
      <div className="sn-reference-modal-backdrop">
        <div className="sn-reference-modal-preview">
          <div className="sn-reference-version">v1 · Home</div>
          <h3 className="sn-reference-headline">
            Ship faster.
            <br />
            Ship now.
          </h3>
          <p className="sn-reference-copy">
            ShipNow 帮助你以对话的方式创建和部署静态网站。输入想法，快速上线。
          </p>
          <div className="sn-reference-preview-actions">
            <SnActionButton variant="primary">Get started</SnActionButton>
            <SnActionButton>Learn more</SnActionButton>
          </div>
        </div>
      </div>
      <div className="sn-reference-phone-panel">
        <div className="sn-reference-sheet">
          <div className="sn-reference-sheet-title">项目状态</div>
          <div className="sn-reference-sheet-close">×</div>
          <div className="sn-reference-status-row">
            <div>
              <div className="sn-reference-label">当前状态</div>
              <StatusChip tone="preview-ready">Preview ready</StatusChip>
              <div className="sn-reference-note">预览已就绪，随时可以发布到线上。</div>
            </div>
          </div>
          <div className="sn-reference-status-block">
            <div className="sn-reference-label">预览地址</div>
            <div className="sn-reference-address">
              <span>https://preview.shipnow.dev/bannercheck</span>
              <Copy className="size-4" />
            </div>
          </div>
          <div className="sn-reference-status-block">
            <div className="sn-reference-label">线上地址</div>
            <div className="sn-reference-note">尚未发布到正式版本</div>
          </div>
          <div className="sn-reference-status-block">
            <div className="sn-reference-label">最近任务</div>
            <div className="sn-reference-task-list">
              <div className="sn-reference-task-item"><span>Build · 预览</span><StatusChip tone="published">成功</StatusChip><time>9:31 AM</time></div>
              <div className="sn-reference-task-item"><span>Generate</span><StatusChip tone="published">成功</StatusChip><time>9:30 AM</time></div>
              <div className="sn-reference-task-item"><span>Deploy · 预览</span><StatusChip tone="published">成功</StatusChip><time>9:29 AM</time></div>
            </div>
          </div>
          <div className="sn-reference-status-block">
            <div className="sn-reference-label">发布历史</div>
            <div className="sn-reference-history-list">
              <div className="sn-reference-history-item"><span>v2 · Home (Updated)</span><small>最新 · 2 分钟前</small></div>
              <div className="sn-reference-history-item"><span>v1 · Home</span><small>今天 09:31</small></div>
            </div>
          </div>
          <div className="sn-reference-status-block">
            <div className="sn-reference-label">技术日志</div>
            <div className="sn-reference-note">查看构建日志，排查问题。</div>
          </div>
        </div>
      </div>
    </ReferenceVisualPhoneShell>
  );
}

function ReferenceConfirmPhone() {
  return (
    <ReferenceVisualPhoneShell className="is-compact">
      <ReferenceVisualPhoneTopBar
        left={<button className="sn-reference-phone-icon-button" type="button" aria-label="返回"><ChevronLeft className="size-5" /></button>}
        title="bannercheck"
        right={<div />}
      />
      <div className="sn-reference-modal-backdrop">
        <div className="sn-reference-modal-preview">
          <div className="sn-reference-version">v1 · Home</div>
          <h3 className="sn-reference-headline">
            Ship faster.
            <br />
            Ship now.
          </h3>
          <p className="sn-reference-copy">
            ShipNow 帮助你以对话的方式创建和部署静态网站。输入想法，快速上线。
          </p>
          <div className="sn-reference-preview-actions">
            <SnActionButton variant="primary">Get started</SnActionButton>
            <SnActionButton>Learn more</SnActionButton>
          </div>
        </div>
      </div>
      <div className="sn-reference-phone-overlay" />
      <div className="sn-reference-phone-sheet is-bottom">
        <div className="sn-reference-sheet-close">×</div>
        <div className="sn-reference-sheet-badge">确认发布</div>
        <div className="sn-reference-sheet-title">确认要把当前版本发布到正式站点吗？</div>
        <div className="sn-reference-address">
          <span>https://bannercheck.shipnow.site</span>
          <Copy className="size-4" />
        </div>
        <div className="sn-reference-checklist">
          <div>将覆盖当前版本：v2 · Home (Updated)</div>
          <div>构建并发布到线上环境</div>
          <div>发布后立即可通过该地址访问</div>
        </div>
        <div className="sn-reference-confirm-actions is-stacked">
          <SnActionButton variant="primary">确认发布</SnActionButton>
          <SnActionButton variant="secondary">取消</SnActionButton>
        </div>
      </div>
    </ReferenceVisualPhoneShell>
  );
}

function ReferenceResultPhone({ success }: { success: boolean }) {
  return (
    <ReferenceVisualPhoneShell className="is-compact">
      <div className="sn-reference-phone-result">
        <div className={`sn-reference-result-figure ${success ? 'is-success' : 'is-failure'}`}>
          <div className="sn-reference-result-cloud is-left" />
          <div className="sn-reference-result-cloud is-center" />
          <div className="sn-reference-result-cloud is-right" />
          <div className={`sn-reference-result-blob ${success ? 'is-success' : 'is-failure'}`}>
            {success ? <CheckCircle2 className="size-6" /> : <CircleAlert className="size-6" />}
          </div>
        </div>
        <div className="sn-reference-result-title">{success ? '发布成功' : '发布失败'}</div>
        <div className="sn-reference-result-copy">
          {success ? '你的网站已上线，全球都可以访问了！' : '部署过程中遇到了一些问题，但我们可以继续修复。'}
        </div>
        <div className="sn-reference-result-card">
          <div className="sn-reference-label">{success ? '线上地址' : '常见原因'}</div>
          {success ? (
            <div className="sn-reference-address">
              <span>https://bannercheck.shipnow.site</span>
              <Copy className="size-4" />
            </div>
          ) : (
            <ul className="sn-reference-bullet-list">
              <li>构建错误</li>
              <li>依赖安装失败</li>
              <li>配置文件问题</li>
            </ul>
          )}
        </div>
        <div className="sn-reference-result-actions is-stacked">
          {success ? (
            <>
              <SnActionButton variant="primary"><ArrowUpRight className="size-4" /> 打开网站</SnActionButton>
              <SnActionButton variant="secondary"><Copy className="size-4" /> 复制链接</SnActionButton>
              <SnActionButton variant="secondary"><Edit2 className="size-4" /> 继续编辑</SnActionButton>
            </>
          ) : (
            <>
              <SnActionButton variant="primary"><Zap className="size-4" /> ShipNow 自动修复</SnActionButton>
              <SnActionButton variant="secondary"><Info className="size-4" /> 查看日志</SnActionButton>
              <SnActionButton variant="secondary">稍后再试</SnActionButton>
            </>
          )}
        </div>
      </div>
    </ReferenceVisualPhoneShell>
  );
}

function ReferenceEntryWelcomePhone() {
  return (
    <ReferenceVisualPhoneShell className="is-compact">
      <ReferenceVisualPhoneTopBar
        left={<div className="sn-reference-mini-brand"><Zap className="size-4" /><span>ShipNow</span></div>}
        title={<div />}
        right={<button className="sn-reference-phone-icon-button" type="button" aria-label="新建项目"><Plus className="size-4" /></button>}
      />
      <div className="sn-reference-phone-body sn-reference-entry-welcome">
        <div className="sn-reference-welcome-title">你好！👋</div>
        <div className="sn-reference-welcome-copy">告诉我你想做什么，我来帮你快速实现。</div>
        <div className="sn-reference-entry-list">
          <div className="sn-reference-entry-card">
            <div className="sn-reference-entry-icon"><Sparkles className="size-4" /></div>
            <div>
              <div className="sn-reference-entry-title">创建产品官网</div>
              <div className="sn-reference-entry-desc">展示产品与功能亮点</div>
            </div>
          </div>
          <div className="sn-reference-entry-card">
            <div className="sn-reference-entry-icon"><WandSparkles className="size-4" /></div>
            <div>
              <div className="sn-reference-entry-title">做一个小游戏</div>
              <div className="sn-reference-entry-desc">轻量有趣的互动体验</div>
            </div>
          </div>
          <div className="sn-reference-entry-card">
            <div className="sn-reference-entry-icon"><Eye className="size-4" /></div>
            <div>
              <div className="sn-reference-entry-title">创建个人主页</div>
              <div className="sn-reference-entry-desc">展示自己与作品集</div>
            </div>
          </div>
        </div>
        <div className="sn-reference-composer-card">
          <div className="sn-reference-composer-rail">
            <button className="sn-reference-phone-icon-button is-soft" type="button" aria-label="附件"><Paperclip className="size-4" /></button>
            <input className="sn-reference-composer-input" placeholder="你想做什么？" />
            <button className="sn-reference-send-button" type="button" aria-label="发送"><Send className="size-4" /></button>
          </div>
          <div className="sn-reference-sample-row">
            <span>产品官网</span>
            <span>小游戏</span>
            <span>个人主页</span>
            <span>工具</span>
          </div>
        </div>
      </div>
    </ReferenceVisualPhoneShell>
  );
}

function ReferenceDrawerPhone() {
  return (
    <ReferenceVisualPhoneShell className="is-compact">
      <div className="sn-reference-drawer-shell">
        <div className="sn-reference-modal-backdrop">
          <div className="sn-reference-modal-preview is-faint">
            <div className="sn-reference-version">v1 · Home</div>
            <h3 className="sn-reference-headline">
              Ship faster.
              <br />
              Ship now.
            </h3>
          </div>
        </div>
        <div className="sn-reference-drawer-sheet">
          <div className="sn-reference-drawer-close">×</div>
          <div className="sn-reference-drawer-brand">
            <div className="sn-reference-mini-brand"><Zap className="size-4" /><span>ShipNow</span></div>
          </div>
          <div className="sn-reference-drawer-item is-highlight"><Plus className="size-4" /><span>新建项目</span></div>
          <div className="sn-reference-drawer-group">
            <div className="sn-reference-drawer-item"><LayoutGrid className="size-4" /><span>模板中心</span><ChevronRight className="size-4" /></div>
            <div className="sn-reference-drawer-item"><Folder className="size-4" /><span>项目管理</span><ChevronRight className="size-4" /></div>
            <div className="sn-reference-drawer-item"><CalendarDays className="size-4" /><span>最近发布</span><ChevronRight className="size-4" /></div>
            <div className="sn-reference-drawer-item"><Settings2 className="size-4" /><span>设置与偏好</span><ChevronRight className="size-4" /></div>
          </div>
          <div className="sn-reference-drawer-user">
            <div className="sn-chat-avatar">艾</div>
            <div>
              <div className="sn-reference-drawer-user-name">艾米</div>
              <div className="sn-reference-drawer-user-mail">hello@shipnow.com</div>
            </div>
          </div>
        </div>
      </div>
    </ReferenceVisualPhoneShell>
  );
}

function ReferenceTemplatePhone() {
  const templates = [
    ['产品官网', '展示产品与功能', true, false, false],
    ['Landing Page', '快速验证活动', false, true, false],
    ['个人主页', '展示自己与作品', false, false, false],
    ['小工具', '解决一个小问题', false, false, false],
    ['小游戏', '轻量有趣的体验', false, false, false],
    ['空白项目', '从空白开始', false, false, true],
  ] as const;

  return (
    <ReferenceVisualPhoneShell className="is-compact">
      <ReferenceVisualPhoneTopBar
        left={<button className="sn-reference-phone-icon-button" type="button" aria-label="菜单"><Menu className="size-4" /></button>}
        title="模板中心"
        right={<div />}
      />
      <div className="sn-reference-phone-body">
        <div className="sn-reference-section-copy">选择一个模板开始</div>
        <div className="sn-reference-template-grid">
          {templates.map(([title, desc, active, dark, empty]) => (
            <div key={title} className={`sn-reference-template-card ${active ? 'is-active' : ''} ${dark ? 'is-dark' : ''} ${empty ? 'is-empty' : ''}`}>
              <div className="sn-reference-template-thumb">
                {empty ? <Plus className="size-7 sn-reference-template-empty-plus" /> : <div className="sn-reference-template-thumb-shape" />}
              </div>
              <div className="sn-reference-template-title">{title}</div>
              <div className="sn-reference-template-desc">{desc}</div>
            </div>
          ))}
        </div>
        <SnActionButton variant="secondary" className="sn-reference-import-btn"><Upload className="size-4" /> 导入现有项目</SnActionButton>
      </div>
    </ReferenceVisualPhoneShell>
  );
}

function ReferenceProjectsPhone() {
  const projects = [
    { name: 'bannercheck', tone: 'Preview ready', time: '今天 9:30 AM', active: true },
    { name: 'v1 · Home', tone: 'Published', time: '今天 9:31 AM', active: false },
    { name: 'v2 · Home (Updated)', tone: 'Needs fix', time: '今天 9:35 AM', active: false },
    { name: '个人主页 / Amy', tone: 'Published', time: '昨天 8:42 PM', active: false },
    { name: '小游戏 - Jump!', tone: 'Preview ready', time: '更新于 2 天前', active: false },
  ] as const;

  return (
    <ReferenceVisualPhoneShell className="is-compact">
      <ReferenceVisualPhoneTopBar
        left={<button className="sn-reference-phone-icon-button" type="button" aria-label="菜单"><Menu className="size-4" /></button>}
        title="我的项目"
        right={<button className="sn-reference-phone-icon-button is-soft" type="button" aria-label="新建"><Plus className="size-4" /></button>}
      />
      <div className="sn-reference-phone-body">
        <div className="sn-reference-project-filter">全部项目 <ChevronDown className="size-4" /></div>
        <div className="sn-reference-project-list">
          {projects.map((project) => (
            <div key={project.name} className={`sn-reference-project-card ${project.active ? 'is-active' : ''}`}>
              <div className="sn-reference-project-thumb" />
              <div className="sn-reference-project-copy">
                <div className="sn-reference-project-head">
                  <div>
                    <div className="sn-reference-project-name">{project.name}</div>
                    <div className="sn-reference-project-desc">产品官网</div>
                  </div>
                  <MoreHorizontal className="size-4 sn-reference-project-more" />
                </div>
                <div className="sn-reference-project-meta">
                  <StatusChip tone={project.tone === 'Published' ? 'published' : project.tone === 'Needs fix' ? 'needs-fix' : 'preview-ready'}>
                    {project.tone}
                  </StatusChip>
                  <span>{project.time}</span>
                </div>
              </div>
              <div className="sn-reference-project-avatar-group">
                {project.active ? (
                  <>
                    <span className="sn-reference-project-avatar" />
                    <span className="sn-reference-project-avatar is-overlap" />
                    <span className="sn-reference-project-avatar-count">+2</span>
                  </>
                ) : (
                  <span className="sn-reference-project-avatar" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ReferenceVisualPhoneShell>
  );
}

function ReferenceChatWorkspacePhone() {
  return (
    <ReferenceVisualPhoneShell className="is-compact">
      <ReferenceVisualPhoneTopBar
        left={<button className="sn-reference-phone-icon-button" type="button" aria-label="菜单"><Menu className="size-4" /></button>}
        title={<div className="sn-reference-phone-brand">ShipNow</div>}
        right={
          <div className="sn-reference-phone-topbar-actions">
            <button className="sn-reference-phone-pill is-status" type="button"><span className="sn-reference-dot" />Preview ready</button>
            <button className="sn-reference-phone-plus" type="button" aria-label="新建"><Plus className="size-4" /></button>
          </div>
        }
      />
      <div className="sn-reference-phone-body sn-reference-chat-phone">
        <div className="sn-reference-project-card is-compact-header">
          <div className="sn-reference-project-thumb is-mini" />
          <div className="sn-reference-project-copy">
            <div className="sn-reference-project-head">
              <div>
                <div className="sn-reference-project-title-row">
                  <div className="sn-reference-project-name">bannercheck</div>
                  <Edit2 className="size-3 sn-reference-project-edit" />
                </div>
                <div className="sn-reference-project-desc">Marketing banner site</div>
              </div>
              <button className="sn-reference-phone-icon-button is-soft" type="button" aria-label="更多"><MoreHorizontal className="size-4" /></button>
            </div>
          </div>
        </div>

        <div className="sn-reference-chat-stack">
          <div className="sn-chat-bubble user">
            <div className="sn-chat-copy">帮我创建一个产品宣传页，突出速度快、部署简单，风格要简洁高级。</div>
            <div className="sn-chat-avatar">A</div>
          </div>
          <div className="sn-chat-bubble assistant">
            <div className="sn-chat-avatar is-assistant"><Sparkles className="size-4" /></div>
            <div className="sn-chat-copy">好的！我为你生成了一个简洁高级的产品宣传页，突出速度快与一键部署的核心卖点。</div>
          </div>
          <AssistantActionCard title="v1 · Home" summary="Hero、核心优势和操作引导先搭起来，整体保持克制与留白。" />
          <div className="sn-chat-bubble user">
            <div className="sn-chat-copy">把配色换成薄荷绿主色，文案再简洁有力一点。</div>
            <div className="sn-chat-avatar">A</div>
          </div>
          <div className="sn-chat-bubble assistant">
            <div className="sn-chat-avatar is-assistant"><Sparkles className="size-4" /></div>
            <div className="sn-chat-copy">已应用薄荷绿主色，并优化了文案表达，让价值主张更直接。</div>
          </div>
          <AssistantActionCard title="v2 · Home (Updated)" summary="继续压缩信息密度，让主视觉与下一步动作更突出。" />
        </div>

        <div className="sn-reference-quick-chip-row">
          <QuickActionChip icon={<Sparkles className="size-4" />}>优化文案</QuickActionChip>
          <QuickActionChip icon={<LayoutGrid className="size-4" />}>调整配色</QuickActionChip>
          <QuickActionChip icon={<Plus className="size-4" />}>增加页面</QuickActionChip>
          <QuickActionChip icon={<Upload className="size-4" />}>上传图片</QuickActionChip>
          <QuickActionChip icon={<CircleAlert className="size-4" />}>修复问题</QuickActionChip>
          <button className="sn-reference-phone-icon-button is-soft" type="button" aria-label="刷新">
            <RefreshCcw className="size-4" />
          </button>
        </div>

        <div className="sn-reference-composer-card is-bottom">
          <div className="sn-reference-composer-rail">
            <button className="sn-reference-phone-icon-button is-soft" type="button" aria-label="附件"><Paperclip className="size-4" /></button>
            <input className="sn-reference-composer-input" placeholder="告诉 ShipNow 你想做什么..." />
            <button className="sn-reference-send-button" type="button" aria-label="发送"><Send className="size-4" /></button>
          </div>
          <div className="sn-reference-composer-actions">
            <SnActionButton variant="secondary"><Eye className="size-4" /> Preview</SnActionButton>
            <SnActionButton variant="primary"><Upload className="size-4" /> Publish</SnActionButton>
          </div>
        </div>
      </div>
    </ReferenceVisualPhoneShell>
  );
}

function DesignSystemPage() {
  return (
    <div className="sn-page">
      <div className="sn-page-backdrop" />
      <div className="sn-ds-desktop">
      <div className="sn-page-shell">
        <DesignSystemHeader />

        <div className="sn-ds-mosaic">
          <Section index={1} label="BUTTONS 按钮" title="Button family" description="Primary、secondary、ghost、destructive 和 icon button。" className="sn-ds-span-2 sn-ds-tall">
            <div className="sn-component-table">
              <div className="sn-component-row">
                <div className="sn-component-labels">
                  <div className="sn-component-en">Primary</div>
                  <div className="sn-component-cn">主要</div>
                </div>
                <SnButton variant="primary">Primary Button</SnButton>
                <SnButton variant="icon" icon={<Plus className="size-4" />} title="Add" />
              </div>
              <div className="sn-component-row">
                <div className="sn-component-labels">
                  <div className="sn-component-en">Secondary</div>
                  <div className="sn-component-cn">次要</div>
                </div>
                <SnButton variant="secondary">Secondary Button</SnButton>
                <SnButton variant="icon" icon={<Plus className="size-4" />} title="Add" />
              </div>
              <div className="sn-component-row">
                <div className="sn-component-labels">
                  <div className="sn-component-en">Ghost</div>
                  <div className="sn-component-cn">幽灵</div>
                </div>
                <SnButton variant="ghost">Ghost Button</SnButton>
                <SnButton variant="icon" icon={<Plus className="size-4" />} title="Add" />
              </div>
              <div className="sn-component-row">
                <div className="sn-component-labels">
                  <div className="sn-component-en">Destructive</div>
                  <div className="sn-component-cn">危险</div>
                </div>
                <SnButton variant="destructive">Delete</SnButton>
                <SnButton variant="icon" icon={<Trash2 className="size-4" />} title="Delete" />
              </div>
            </div>
          </Section>

          <Section index={2} label="STATUS CHIPS 状态标签" title="Status and action chips" description="预览、上线、构建中、需要修复的状态标签，以及快捷动作。">
            <div className="sn-chip-stack">
              <div className="sn-chip-row">
                <StatusChip tone="preview-ready">Preview ready</StatusChip>
                <StatusChip tone="published">Published</StatusChip>
                <StatusChip tone="building">Building</StatusChip>
                <StatusChip tone="needs-fix">Needs fix</StatusChip>
              </div>
            </div>
          </Section>

          <Section index={3} label="QUICK ACTION CHIPS 快速操作芯片" title="Quick action chips" description="语义明确的快捷入口，适合常用编辑动作。">
            <div className="sn-chip-stack">
              <div className="sn-chip-row sn-chip-row-inline">
                <StatusChip tone="preview-ready">Status Chip</StatusChip>
                <QuickActionChip icon={<Sparkles className="size-4" />}>Quick Chip</QuickActionChip>
              </div>
              <div className="sn-chip-row">
                <QuickActionChip icon={<Sparkles className="size-4" />}>优化文案</QuickActionChip>
                <QuickActionChip icon={<LayoutGrid className="size-4" />}>调整配色</QuickActionChip>
                <QuickActionChip icon={<Plus className="size-4" />}>增加页面</QuickActionChip>
                <SnButton variant="icon" icon={<Plus className="size-4" />} title="更多动作" />
              </div>
            </div>
          </Section>

          <Section index={4} label="CHAT BUBBLES 聊天气泡" title="Chat bubbles" description="用户气泡、ShipNow 助手气泡和执行中状态。" className="sn-ds-tall">
            <div className="sn-chat-stack">
              <ChatBubble role="user">帮我创建一个产品宣传页，突出速度快、部署简单，风格要简洁高级。</ChatBubble>
              <ChatBubble role="assistant">好的！我为你生成了一个简洁高级的产品宣传页。</ChatBubble>
              <ChatBubble role="thinking">ShipNow 正在修改并重新构建预览…</ChatBubble>
            </div>
          </Section>

          <Section index={5} label="ASSISTANT ACTION CARD 助手操作卡片" title="Assistant action card" description="带预览缩略图、版本名、变更摘要和三个主要动作。" className="sn-ds-span-2">
            <AssistantActionCard
              title="v1 · Home"
              summary="把配色换成薄荷绿主色，并把首屏文案压缩成更直接的价值表达。"
            />
          </Section>

          <Section index={6} label="PROJECT CARD 项目卡片" title="Project cards" description="项目卡片取代表格，保留状态、描述和更新时间。">
            <div className="sn-card-list">
              <ProjectCard
                name="bannercheck"
                description="Marketing banner site"
                status="preview-ready"
                updatedAt="Updated 12 minutes ago"
              />
              <ProjectCard
                name="loveadventure"
                description="Interactive campaign page"
                status="published"
                updatedAt="Updated 2 hours ago"
              />
            </div>
          </Section>

          <Section index={7} label="BOTTOM COMPOSER 底部输入区" title="Bottom composer" description="附件、输入框、发送、Preview、Publish 常驻底部的结构。" className="sn-ds-span-2">
            <Composer />
          </Section>

          <Section index={8} label="TOP BAR VARIANTS 顶部栏变体" title="Top bar states" description="主工作台、项目页、预览页三种顶部状态。">
            <div className="sn-topbar-stack">
              <div className="sn-topbar-preview">
                <TopBar mode="workspace" />
              </div>
              <div className="sn-topbar-preview">
                <TopBar mode="project" />
              </div>
              <div className="sn-topbar-preview">
                <TopBar mode="preview" />
              </div>
            </div>
          </Section>

          <Section index={9} label="DRAWER LIST ITEMS 抽屉列表项" title="Drawer list items" description="左侧项目抽屉和右侧状态抽屉的列表样式。" className="sn-ds-span-2">
            <div className="sn-two-column">
              <DrawerMock side="left" title="项目抽屉">
                <div className="sn-drawer-list">
                  <DrawerListItem icon={<Folder className="size-4" />} title="Primary Button" subtitle="主操作按钮" />
                  <DrawerListItem icon={<Plus className="size-4" />} title="Secondary Button" subtitle="次要按钮" />
                  <DrawerListItem icon={<CheckCircle2 className="size-4" />} title="Status Chip" subtitle="状态芯片" />
                  <DrawerListItem icon={<Sparkles className="size-4" />} title="Quick Chip" subtitle="快速操作芯片" />
                </div>
              </DrawerMock>

              <DrawerMock side="right" title="状态抽屉">
                <div className="sn-drawer-list">
                  <div className="sn-drawer-metric">
                    <span>预览地址</span>
                    <strong>api.boringmax.com/shipnow/preview/bannercheck</strong>
                  </div>
                  <div className="sn-drawer-metric">
                    <span>线上地址</span>
                    <strong>boringmax.com/bannercheck</strong>
                  </div>
                  <div className="sn-drawer-metric">
                    <span>最近任务</span>
                    <strong>apply_change</strong>
                  </div>
                  <div className="sn-drawer-metric">
                    <span>发布历史</span>
                    <strong>2 entries</strong>
                  </div>
                </div>
              </DrawerMock>
            </div>
          </Section>

          <Section index={10} label="CONFIRMATION SHEET 确认底部弹窗" title="Confirmation sheets" description="发布确认和删除确认弹层。">
            <div className="sn-sheet-grid">
              <ConfirmationSheet
                title="确认发布到正式站点"
                description="ShipNow 会将当前预览复制到正式站点，并使用公开地址作为访问入口。"
                confirmLabel="Publish"
              />
              <ConfirmationSheet
                title="确认删除项目"
                description="删除后会移除工作区与任务记录，但保留已发布的静态站点文件。"
                confirmLabel="Delete"
                destructive
              />
            </div>
          </Section>

          <Section index={11} label="EMPTY STATE CARD 空状态卡片" title="Empty states" description="没有项目和没有发布记录的空状态。">
            <div className="sn-empty-grid">
              <EmptyState
                title="No projects yet"
                description="Start a conversation to build your first site."
                icon={<Plus className="size-6" />}
              />
              <EmptyState
                title="No releases yet"
                description="There are no published versions here yet."
                icon={<Check className="size-6" />}
              />
            </div>
          </Section>

          <Section index={12} label="ICON SET 图标集" title="Icon set" description="统一线性图标风格。" className="sn-ds-span-2">
            <div className="sn-icon-grid">
              <IconTile icon={<Menu className="size-5" />} label="Menu" />
              <IconTile icon={<Paperclip className="size-5" />} label="Attachment" />
              <IconTile icon={<Sparkles className="size-5" />} label="Sparkles" />
              <IconTile icon={<Eye className="size-5" />} label="Preview" />
              <IconTile icon={<Send className="size-5" />} label="Send" />
              <IconTile icon={<CheckCircle2 className="size-5" />} label="Check" />
              <IconTile icon={<Plus className="size-5" />} label="Plus" />
              <IconTile icon={<Upload className="size-5" />} label="Upload" />
              <IconTile icon={<Download className="size-5" />} label="Download" />
              <IconTile icon={<Trash2 className="size-5" />} label="Trash" />
              <IconTile icon={<MoreVertical className="size-5" />} label="More" />
              <IconTile icon={<Search className="size-5" />} label="Search" />
              <IconTile icon={<Settings2 className="size-5" />} label="Settings" />
              <IconTile icon={<AlertTriangle className="size-5" />} label="Warning" />
              <IconTile icon={<Info className="size-5" />} label="Info" />
              <IconTile icon={<User className="size-5" />} label="User" />
              <IconTile icon={<Folder className="size-5" />} label="Folder" />
              <IconTile icon={<Link2 className="size-5" />} label="Link" />
              <IconTile icon={<ArrowUpRight className="size-5" />} label="External" />
              <IconTile icon={<RefreshCcw className="size-5" />} label="Refresh" />
            </div>
          </Section>

          <Section index={13} label="TOKENS 设计令牌" title="Design tokens" description="颜色、间距、圆角和排版令牌。" className="sn-ds-span-3">
            <div className="sn-token-section">
              <div className="sn-token-group">
                <div className="sn-token-group-title">Color 颜色</div>
                <div className="sn-token-grid">
                  {DESIGN_SYSTEM_TOKENS.map((token) => (
                    <DemoToken key={token.name} {...token} />
                  ))}
                </div>
              </div>
              <div className="sn-token-group">
                <div className="sn-token-group-title">Spacing 间距（8pt 基础）</div>
                <div className="sn-spacing-list">
                  {[
                    ['4', '4px'],
                    ['8', '8px'],
                    ['12', '12px'],
                    ['16', '16px'],
                    ['24', '24px'],
                    ['32', '32px'],
                  ].map(([label, value]) => (
                    <div key={label} className="sn-spacing-row">
                      <span className="sn-spacing-dot" />
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="sn-token-group">
                <div className="sn-token-group-title">Radius 圆角</div>
                <div className="sn-radius-list">
                  {[
                    ['xs', '4px'],
                    ['sm', '8px'],
                    ['md', '12px'],
                    ['lg', '16px'],
                    ['xl', '24px'],
                    ['2xl', '32px'],
                  ].map(([label, value]) => (
                    <div key={label} className="sn-radius-row">
                      <span className="sn-radius-swatch" />
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section index={14} label="TYPOGRAPHY 字体系统" title="Typography" description="字体家族与字号层级。" className="sn-ds-span-3">
            <div className="sn-typography-grid">
              <div className="sn-typography-mark">Aa</div>
              <div className="sn-typography-family">
                <div>
                  <div className="sn-token-group-title">Font</div>
                  <div className="sn-font-list">
                    <span>Plus Jakarta Sans</span>
                    <span>Inter</span>
                    <span>Fira Code</span>
                  </div>
                </div>
              </div>
              <div className="sn-typography-samples">
                <TypographyRow label="Heading / H1" value="32 / 40 · SemiBold" />
                <TypographyRow label="Heading / H2" value="24 / 32 · SemiBold" />
                <TypographyRow label="Heading / H3" value="18 / 24 · Medium" />
                <TypographyRow label="Body / Regular" value="14 / 22 · Regular" />
                <TypographyRow label="Body / Small" value="12 / 16 · Regular" />
                <TypographyRow label="Caption" value="11 / 14 · Regular" />
                <TypographyRow label="Code" value="12 / 18 · Mono" mono />
              </div>
            </div>
          </Section>

          <Section index={15} label="NOTES 备注" title="Notes" description="图底部的行为提示。">
            <div className="sn-notes">
              <NoteItem>Conversation is the center.</NoteItem>
              <NoteItem>Every action is one tap away.</NoteItem>
              <NoteItem>Preview early. Publish with confidence.</NoteItem>
              <NoteItem>Built for calm, creative flow.</NoteItem>
            </div>
          </Section>
        </div>
      </div>
      </div>
      <MobileDesignSystemPage />
    </div>
  );
}

function VisualReferencePage() {
  const palette = [
    ['Mint', '#B7F1DF'],
    ['Sage', '#E8F5EF'],
    ['Ivory', '#FAF7F3'],
    ['Stone', '#E7E5E1'],
    ['Ink', '#0F1115'],
  ] as const;

  const principles = ['对话驱动，轻松创建', '即时预览，所见即所得', '一键发布，自动部署'];

  const recentProjects = [
    { name: 'bannercheck', description: 'Marketing banner site', version: 'v2 · Home (Updated)', time: '2 分钟前', tone: 'preview-ready' as Tone },
    { name: 'mini-landing', description: '产品上新页', version: 'v1 · Home', time: '今天 10:15', tone: 'published' as Tone },
    { name: 'docs-site', description: '文档站点', version: 'v3 · Docs', time: '昨天 18:20', tone: 'building' as Tone },
    { name: 'portfolio', description: '个人作品集', version: 'v1 · Home', time: '昨天 16:30', tone: 'preview-ready' as Tone },
    { name: 'event-2024', description: '活动型落地页', version: 'v1 · Promo', time: '5 天前', tone: 'building' as Tone },
  ];

  return (
    <div className="sn-page sn-page-visual">
      <div className="sn-page-backdrop" />
      <section className="sn-reference-masthead">
        <div className="sn-reference-masthead-brand">
          <div className="sn-visual-brand">
            <div className="sn-visual-mark">
              <Zap className="size-7" />
            </div>
            <div className="sn-visual-brand-copy">
              <div className="sn-visual-brand-name">ShipNow</div>
              <p className="sn-visual-brand-tagline">
                Chat-first vibe coding &
                <br />
                one-click auto-deploy for small static sites.
              </p>
            </div>
          </div>
          <div className="sn-reference-masthead-copy">
            <div className="sn-reference-masthead-title">从想法到上线，只需一次对话。</div>
            <div className="sn-reference-masthead-subtitle">AI 驱动的静态站点与前端应用构建平台</div>
          </div>
        </div>

        <div className="sn-reference-masthead-stack">
          <div className="sn-reference-token-block">
            <div className="sn-visual-kicker">COLOR PALETTE</div>
            <div className="sn-reference-palette-row">
              {palette.map(([name, value]) => (
                <div key={name} className="sn-visual-palette-item">
                  <div className="sn-visual-palette-swatch" style={{ background: `var(--sn-color-${name.toLowerCase()})` }} />
                  <div className="sn-visual-palette-name">{name}</div>
                  <div className="sn-visual-palette-value">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="sn-reference-token-block">
            <div className="sn-visual-kicker">TYPOGRAPHY</div>
            <div className="sn-reference-type-grid">
              <div className="sn-visual-type">
                <div className="sn-visual-type-row">
                  <span>Plus Jakarta Sans</span>
                  <span>Heading</span>
                </div>
                <div className="sn-visual-type-row">
                  <span>Inter</span>
                  <span>Body</span>
                </div>
                <div className="sn-visual-type-row">
                  <span>Fira Code</span>
                  <span>Code</span>
                </div>
              </div>
              <div className="sn-visual-mark-glyph">Aa</div>
            </div>
          </div>
        </div>
      </section>

      <section className="sn-reference-section">
        <div className="sn-visual-section-head">
          <div className="sn-hero-kicker">01 · 预览体验</div>
          <div className="sn-hero-title">沉浸式预览，所见即所得。</div>
        </div>
        <div className="sn-reference-phone-grid sn-reference-phone-grid-preview">
          <ReferencePreviewPhone />
          <ReferenceStatusPhone />
          <ReferenceConfirmPhone />
          <ReferenceResultPhone success />
          <ReferenceResultPhone success={false} />
        </div>
        <div className="sn-reference-note-grid">
          <div className="sn-reference-note-card">
            <div className="sn-reference-note-icon"><Sparkles className="size-4" /></div>
            <div>
              <div className="sn-reference-note-title">对话式创建</div>
              <div className="sn-reference-note-desc">从想法到页面，从预览到发布，一条消息就能推进。</div>
            </div>
          </div>
          <div className="sn-reference-note-card">
            <div className="sn-reference-note-icon"><Eye className="size-4" /></div>
            <div>
              <div className="sn-reference-note-title">即时预览</div>
              <div className="sn-reference-note-desc">所见即所得，状态变化立刻可见。</div>
            </div>
          </div>
          <div className="sn-reference-note-card">
            <div className="sn-reference-note-icon"><Upload className="size-4" /></div>
            <div>
              <div className="sn-reference-note-title">一键发布</div>
              <div className="sn-reference-note-desc">确认后直接推送到 CDN，减少来回切页。</div>
            </div>
          </div>
          <div className="sn-reference-note-card is-outline">
            <div className="sn-reference-note-icon"><CheckCircle2 className="size-4" /></div>
            <div>
              <div className="sn-reference-note-title">安全可靠</div>
              <div className="sn-reference-note-desc">HTTPS、CDN 和状态确认，发布更安心。</div>
            </div>
          </div>
        </div>
      </section>

      <section className="sn-reference-section">
        <div className="sn-visual-section-head">
          <div className="sn-hero-kicker">02 · 入口抽屉</div>
          <div className="sn-hero-title">从想法开始，快速进入项目 / 模板 / 项目管理。</div>
        </div>
        <div className="sn-reference-phone-grid sn-reference-phone-grid-entry">
          <ReferenceEntryWelcomePhone />
          <ReferenceDrawerPhone />
          <ReferenceTemplatePhone />
          <ReferenceProjectsPhone />
        </div>
        <div className="sn-reference-note-grid sn-reference-note-grid-steps">
          <div className="sn-reference-note-card">
            <div className="sn-reference-note-icon"><span className="sn-reference-step-number">1</span></div>
            <div>
              <div className="sn-reference-note-title">欢迎 / 新建项目</div>
              <div className="sn-reference-note-desc">对话式入口，降低启动门槛，用自然语言描述想法。</div>
            </div>
          </div>
          <div className="sn-reference-note-card">
            <div className="sn-reference-note-icon"><span className="sn-reference-step-number">2</span></div>
            <div>
              <div className="sn-reference-note-title">侧边导航抽屉</div>
              <div className="sn-reference-note-desc">轻量侧边导航，快速访问核心功能：新建、模板、项目、发布与设置。</div>
            </div>
          </div>
          <div className="sn-reference-note-card">
            <div className="sn-reference-note-icon"><span className="sn-reference-step-number">3</span></div>
            <div>
              <div className="sn-reference-note-title">模板中心</div>
              <div className="sn-reference-note-desc">精选模板卡片，覆盖常见场景，支持快速启用或从空白开始。</div>
            </div>
          </div>
          <div className="sn-reference-note-card is-outline">
            <div className="sn-reference-note-icon"><span className="sn-reference-step-number">4</span></div>
            <div>
              <div className="sn-reference-note-title">项目管理</div>
              <div className="sn-reference-note-desc">卡片式项目列表，一目了然掌握状态、更新时间与协作成员。</div>
            </div>
          </div>
        </div>
      </section>

      <section className="sn-reference-section">
        <div className="sn-visual-section-head">
          <div className="sn-hero-kicker">03 · 项目工作台</div>
          <div className="sn-hero-title">对话驱动的移动工作区。</div>
        </div>
        <div className="sn-reference-workspace-grid">
          <aside className="sn-visual-identity">
            <div className="sn-visual-brand">
              <div className="sn-visual-mark">
                <Zap className="size-7" />
              </div>
              <div className="sn-visual-brand-copy">
                <div className="sn-visual-brand-name">ShipNow</div>
                <p className="sn-visual-brand-tagline">
                  Chat-first vibe coding &
                  <br />
                  one-click auto-deploy for small static sites.
                </p>
              </div>
            </div>

            <div className="sn-visual-block">
              <div className="sn-visual-kicker">COLOR PALETTE</div>
              <div className="sn-visual-palette">
                {palette.map(([name, value]) => (
                  <div key={name} className="sn-visual-palette-item">
                    <div className="sn-visual-palette-swatch" style={{ background: `var(--sn-color-${name.toLowerCase()})` }} />
                    <div className="sn-visual-palette-name">{name}</div>
                    <div className="sn-visual-palette-value">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sn-visual-block">
              <div className="sn-visual-kicker">TYPOGRAPHY</div>
              <div className="sn-visual-type">
                <div className="sn-visual-type-row">
                  <span>Plus Jakarta Sans</span>
                  <span>Heading</span>
                </div>
                <div className="sn-visual-type-row">
                  <span>Inter</span>
                  <span>Body</span>
                </div>
                <div className="sn-visual-type-row">
                  <span>Fira Code</span>
                  <span>Code</span>
                </div>
              </div>
              <div className="sn-visual-mark-glyph">Aa</div>
            </div>

            <ul className="sn-visual-principles">
              {principles.map((item) => (
                <li key={item}>
                  <CheckCircle2 className="size-4" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>

          <ReferenceChatWorkspacePhone />
        </div>
        <div className="sn-reference-note-grid">
          <div className="sn-reference-note-card">
            <div className="sn-reference-note-icon"><Sparkles className="size-4" /></div>
            <div>
              <div className="sn-reference-note-title">即时预览</div>
              <div className="sn-reference-note-desc">聊天和预览并排，不打断当前操作。</div>
            </div>
          </div>
          <div className="sn-reference-note-card">
            <div className="sn-reference-note-icon"><Upload className="size-4" /></div>
            <div>
              <div className="sn-reference-note-title">一键发布</div>
              <div className="sn-reference-note-desc">底部动作常驻，发布随手可达。</div>
            </div>
          </div>
          <div className="sn-reference-note-card is-outline">
            <div className="sn-reference-note-icon"><CheckCircle2 className="size-4" /></div>
            <div>
              <div className="sn-reference-note-title">安全收口</div>
              <div className="sn-reference-note-desc">状态、发布和日志都收纳到更清晰的层次里。</div>
            </div>
          </div>
        </div>
      </section>

      <div className="sn-visual-section-head sn-reference-desktop-head">
        <div className="sn-hero-kicker">04 · 桌面工作台概念</div>
        <div className="sn-hero-title">三栏工作台，中央对话是视觉中心。</div>
      </div>
      <div className="sn-visual-desktop">
        <div className="sn-visual-layout">
        <aside className="sn-visual-identity">
          <div className="sn-visual-brand">
            <div className="sn-visual-mark">
              <Zap className="size-7" />
            </div>
            <div className="sn-visual-brand-copy">
              <div className="sn-visual-brand-name">ShipNow</div>
              <p className="sn-visual-brand-tagline">
                Chat-first vibe coding &
                <br />
                one-click auto-deploy for small static sites.
              </p>
            </div>
          </div>

          <div className="sn-visual-block">
            <div className="sn-visual-kicker">COLOR PALETTE</div>
            <div className="sn-visual-palette">
              {palette.map(([name, value]) => (
                <div key={name} className="sn-visual-palette-item">
                  <div className="sn-visual-palette-swatch" style={{ background: `var(--sn-color-${name.toLowerCase()})` }} />
                  <div className="sn-visual-palette-name">{name}</div>
                  <div className="sn-visual-palette-value">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="sn-visual-block">
            <div className="sn-visual-kicker">TYPOGRAPHY</div>
            <div className="sn-visual-type">
              <div className="sn-visual-type-row">
                <span>Plus Jakarta Sans</span>
                <span>Heading</span>
              </div>
              <div className="sn-visual-type-row">
                <span>Inter</span>
                <span>Body</span>
              </div>
              <div className="sn-visual-type-row">
                <span>Fira Code</span>
                <span>Code</span>
              </div>
            </div>
            <div className="sn-visual-mark-glyph">Aa</div>
          </div>

          <ul className="sn-visual-principles">
            {principles.map((item) => (
              <li key={item}>
                <CheckCircle2 className="size-4" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="sn-visual-right">
          <section className="sn-visual-shell sn-panel">
            <div className="sn-visual-shell-top">
              <div className="sn-visual-window-dots">
                <span />
                <span />
                <span />
              </div>
              <div className="sn-visual-window-badge">工作台概念</div>
            </div>

            <div className="sn-visual-workspace">
              <aside className="sn-visual-sidebar">
                <div className="sn-visual-sidebar-head">
                  <div className="sn-brand-stack">
                    <div className="sn-brand-mark sn-brand-mark--compact">SN</div>
                    <div>
                      <div className="sn-brand-title">ShipNow</div>
                      <div className="sn-brand-subtitle">bannercheck</div>
                    </div>
                  </div>
                </div>

                <SnButton variant="primary" className="sn-visual-create-btn">
                  + 新建项目
                </SnButton>

                <div className="sn-visual-sidebar-section">
                  <div className="sn-visual-sidebar-label">项目</div>
                  <div className="sn-visual-sidebar-list">
                    <div className="sn-visual-sidebar-item active">
                      <div className="sn-project-avatar" />
                      <div>
                        <div className="sn-visual-sidebar-item-title">bannercheck</div>
                        <div className="sn-visual-sidebar-item-subtitle">Marketing banner site</div>
                      </div>
                    </div>
                    <div className="sn-visual-sidebar-item">
                      <div className="sn-project-avatar" />
                      <div>
                        <div className="sn-visual-sidebar-item-title">mini-landing</div>
                        <div className="sn-visual-sidebar-item-subtitle">产品上新页</div>
                      </div>
                    </div>
                    <div className="sn-visual-sidebar-item">
                      <div className="sn-project-avatar" />
                      <div>
                        <div className="sn-visual-sidebar-item-title">docs-site</div>
                        <div className="sn-visual-sidebar-item-subtitle">文档站点</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sn-visual-sidebar-section">
                  <div className="sn-visual-sidebar-label">模板</div>
                  <div className="sn-visual-sidebar-list sn-visual-template-list">
                    <div className="sn-visual-sidebar-item sn-visual-sidebar-item-plain">空白项目</div>
                    <div className="sn-visual-sidebar-item sn-visual-sidebar-item-plain">个人作品集</div>
                    <div className="sn-visual-sidebar-item sn-visual-sidebar-item-plain">产品官网</div>
                    <div className="sn-visual-sidebar-item sn-visual-sidebar-item-plain">活动页</div>
                    <div className="sn-visual-sidebar-item sn-visual-sidebar-item-plain">查看更多模板</div>
                  </div>
                </div>

                <div className="sn-visual-sidebar-foot">
                  <div className="sn-visual-user">
                    <div className="sn-chat-avatar">L</div>
                    <div>
                      <div className="sn-visual-user-name">林小夏</div>
                      <div className="sn-visual-user-mail">xiaoxia@shipnow.dev</div>
                    </div>
                  </div>
                  <Settings2 className="size-4 sn-visual-muted-icon" />
                </div>
              </aside>

              <main className="sn-visual-main">
                <header className="sn-visual-main-head">
                  <div className="sn-visual-project-head">
                    <div className="sn-visual-project-mark" />
                    <div>
                      <div className="sn-visual-project-name">bannercheck</div>
                      <div className="sn-visual-project-subtitle">Marketing banner site</div>
                    </div>
                  </div>
                  <div className="sn-visual-main-actions">
                    <StatusChip tone="preview-ready">已保存</StatusChip>
                    <div className="sn-visual-avatars">
                      <span className="sn-visual-avatar" />
                      <span className="sn-visual-avatar" />
                      <span className="sn-visual-avatar sn-visual-avatar-plus">+</span>
                    </div>
                    <SnButton variant="icon" icon={<MoreHorizontal className="size-4" />} title="更多" />
                  </div>
                </header>

                <div className="sn-visual-chat-shell">
                  <ChatBubble role="user">帮我创建一个产品宣传页，突出速度快、部署简单，风格要简洁高级。</ChatBubble>
                  <ChatBubble role="assistant">好的！我为你生成了一个简洁高级的产品宣传页。</ChatBubble>
                  <AssistantActionCard
                    title="v1 · Home"
                    summary="首个版本先把 Hero、核心优势和行动按钮搭起来，视觉节奏更克制。"
                  />
                  <ChatBubble role="user">把配色换成薄荷绿主色，文案再简洁有力一点。</ChatBubble>
                  <ChatBubble role="assistant">已应用薄荷绿主色，并把文案压缩得更直接。</ChatBubble>
                  <AssistantActionCard
                    title="v2 · Home Updated"
                    summary="继续压缩内容密度，让主要价值主张和下一步动作更突出。"
                  />
                </div>

                <div className="sn-visual-composer-wrap">
                  <Composer />
                </div>
              </main>

              <aside className="sn-visual-status">
                <div className="sn-visual-status-block">
                  <div className="sn-visual-status-title">项目状态</div>
                  <div className="sn-visual-status-line">
                    <span className="sn-visual-status-dot" />
                    <div>就绪可发布</div>
                  </div>
                  <p>你可以随时发布当前版本。</p>
                </div>

                <div className="sn-visual-status-block">
                  <div className="sn-visual-status-title">当前版本</div>
                  <div className="sn-visual-version">v2 · Home (Updated)</div>
                  <p>最近保存于 2 分钟前</p>
                  <SnButton variant="primary" className="sn-visual-open-btn">
                    打开预览
                  </SnButton>
                </div>

                <div className="sn-visual-status-block">
                  <div className="sn-visual-status-title">发布</div>
                  <SnButton variant="secondary" className="sn-visual-publish-btn">
                    一键发布
                  </SnButton>
                  <p>自动把静态站点推到 CDN。</p>
                </div>

                <div className="sn-visual-status-block">
                  <div className="sn-visual-status-title">最近发布</div>
                  <div className="sn-visual-release-list">
                    <div className="sn-visual-release-item">
                      <span className="sn-visual-release-dot" />
                      <div>
                        <div className="sn-visual-release-name">v2 · Home (Updated)</div>
                        <div className="sn-visual-release-meta">最新 · 2 分钟前</div>
                      </div>
                    </div>
                    <div className="sn-visual-release-item">
                      <span className="sn-visual-release-dot" />
                      <div>
                        <div className="sn-visual-release-name">v1 · Home</div>
                        <div className="sn-visual-release-meta">今天 09:31</div>
                      </div>
                    </div>
                    <div className="sn-visual-release-item">
                      <span className="sn-visual-release-dot" />
                      <div>
                        <div className="sn-visual-release-name">v0 · Initial</div>
                        <div className="sn-visual-release-meta">今天 09:21</div>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <section className="sn-visual-bottom-grid">
            <div className="sn-panel sn-visual-split">
              <div className="sn-visual-section-head">
                <div className="sn-hero-kicker">02 · 预览 · Split View</div>
                <div className="sn-hero-title">实时预览和对话并排工作。</div>
              </div>
              <div className="sn-visual-split-stack">
                <div className="sn-visual-split-topbar">
                  <div className="sn-visual-split-topbar-left">
                    <div className="sn-visual-split-url">bannercheck.shipnow.dev</div>
                    <StatusChip tone="preview-ready">Live preview</StatusChip>
                  </div>
                  <div className="sn-visual-split-topbar-right">
                    <div className="sn-visual-split-mini-chip">Chat</div>
                    <div className="sn-visual-split-mini-chip active">Preview</div>
                    <div className="sn-visual-split-mini-chip">Publish</div>
                  </div>
                </div>
                <div className="sn-visual-split-grid">
                  <div className="sn-visual-split-rail" aria-label="Workspace shortcuts">
                    <button className="sn-visual-split-rail-btn active" type="button" aria-label="对话视图">
                      <Sparkles className="size-4" />
                    </button>
                    <button className="sn-visual-split-rail-btn" type="button" aria-label="主页">
                      <Home className="size-4" />
                    </button>
                    <button className="sn-visual-split-rail-btn" type="button" aria-label="项目总览">
                      <LayoutGrid className="size-4" />
                    </button>
                    <button className="sn-visual-split-rail-btn" type="button" aria-label="设置">
                      <Settings2 className="size-4" />
                    </button>
                  </div>
                  <div className="sn-visual-split-chat">
                    <div className="sn-visual-split-chat-card">
                      <div className="sn-visual-split-chat-label">Assistant</div>
                      <ChatBubble role="assistant">把页面主视觉拉大一点，同时保持整体呼吸感。</ChatBubble>
                    </div>
                    <div className="sn-visual-split-chat-card sn-visual-split-chat-card-user">
                      <div className="sn-visual-split-chat-label">User</div>
                      <ChatBubble role="user">好，保留大标题和两个动作按钮，其他元素压缩掉。</ChatBubble>
                    </div>
                  </div>
                  <div className="sn-visual-preview-canvas">
                    <div className="sn-visual-preview-top">
                      <span>https://bannercheck.shipnow.dev</span>
                      <div className="sn-visual-preview-icons">
                        <Eye className="size-4" />
                        <Copy className="size-4" />
                        <ArrowUpRight className="size-4" />
                      </div>
                    </div>
                    <div className="sn-visual-preview-content">
                      <div className="sn-visual-preview-brand">ShipNow</div>
                      <h3>Ship faster.<br />Ship now.</h3>
                      <p>对话驱动的静态站点构建器，更快上线，更自然创作。</p>
                      <div className="sn-visual-preview-actions">
                        <button className="sn-button sn-button-primary">立即开始</button>
                        <button className="sn-button sn-button-secondary">查看文档</button>
                      </div>
                      <div className="sn-visual-preview-features">
                        <div className="sn-visual-preview-feature">即刻构建</div>
                        <div className="sn-visual-preview-feature">一键发布</div>
                        <div className="sn-visual-preview-feature">静态托管</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sn-panel sn-visual-projects">
              <div className="sn-visual-section-head sn-visual-projects-head">
                <div>
                  <div className="sn-hero-kicker">03 · 项目总览</div>
                  <div className="sn-hero-title">所有项目</div>
                </div>
                <div className="sn-visual-projects-toolbar">
                  <div className="sn-visual-projects-pills">
                    <div className="sn-visual-split-mini-chip active">全部</div>
                    <div className="sn-visual-split-mini-chip">预览就绪</div>
                    <div className="sn-visual-split-mini-chip">已发布</div>
                  </div>
                  <SnButton variant="secondary" className="sn-visual-toolbar-btn">
                    + 高级模式
                  </SnButton>
                  <div className="sn-chat-avatar">L</div>
                </div>
              </div>

              <div className="sn-visual-project-grid">
                {recentProjects.map((project) => (
                  <div
                    key={project.name}
                    className={`sn-visual-project-tile ${project.name === 'bannercheck' ? 'active sn-visual-project-tile-featured' : ''}`}
                  >
                    {project.name === 'bannercheck' ? (
                      <div className="sn-visual-project-tile-media">
                        <div className="sn-visual-project-tile-media-bar" />
                        <div className="sn-visual-project-tile-media-card">
                          <div className="sn-visual-project-tile-media-title">Ship faster. Ship now.</div>
                          <div className="sn-visual-project-tile-media-line" />
                          <div className="sn-visual-project-tile-media-line short" />
                        </div>
                      </div>
                    ) : null}
                    <div className="sn-visual-project-tile-head">
                      <div>
                        <div className="sn-visual-project-tile-name">{project.name}</div>
                        <div className="sn-visual-project-tile-desc">{project.description}</div>
                      </div>
                      <StatusChip tone={project.tone}>{project.tone === 'building' ? '构建中' : '已保存'}</StatusChip>
                    </div>
                    <div className="sn-visual-project-tile-version">{project.version}</div>
                    <div className="sn-visual-project-tile-time">{project.time}</div>
                  </div>
                ))}
                <div className="sn-visual-project-tile sn-visual-project-tile-new">
                  <Plus className="size-5" />
                  <div className="sn-visual-project-tile-name">新建项目</div>
                  <div className="sn-visual-project-tile-time">从空白开始创建新的站点</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      </div>
    </div>
  );
}

export function ShipNowDesignSystemPage() {
  return <DesignSystemPage />;
}

export function ShipNowVisualReferencePage() {
  return <VisualReferencePage />;
}
