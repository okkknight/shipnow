import { useEffect, useState } from 'react';
import { ArrowUpRight, CheckCircle2, CircleAlert, Copy, Edit2, Info, Sparkles, Upload, Zap, ChevronLeft } from 'lucide-react';
import { MobileActionButton, MobilePageSurface } from './shipnow-real-ui';
import { StatusChip } from './shipnow-ui';

export function MobilePreviewPage({
  projectName,
  previewUrl,
  onBackEdit,
  onPublish,
  embedded = false,
}: {
  projectName: string;
  previewUrl: string;
  onBackEdit: () => void;
  onPublish: () => void;
  embedded?: boolean;
}) {
  return (
    <MobilePageSurface className={`sn-mobile-preview-page ${embedded ? 'sn-mobile-preview-page-embedded' : ''}`.trim()}>
      <div className="sn-mobile-preview-visual">
        <header className="sn-mobile-preview-nav">
          <button className="sn-mobile-preview-nav-icon" type="button" aria-label="返回" onClick={onBackEdit}>
            <ChevronLeft className="size-5" />
          </button>
          <div className="sn-mobile-preview-nav-copy">
            <div className="sn-mobile-preview-nav-title">{projectName}</div>
            <StatusChip tone="preview-ready">预览中</StatusChip>
          </div>
        </header>

        <div className="sn-mobile-preview-body">
          <div className="sn-mobile-preview-frame-shell">
            <iframe
              className="sn-mobile-preview-frame"
              src={previewUrl}
              title={`${projectName} 预览`}
              loading="eager"
            />
          </div>

          <div className="sn-mobile-preview-footer-actions">
            <MobileActionButton variant="secondary" className="sn-mobile-preview-footer-secondary" onClick={onBackEdit}>
              <Sparkles className="size-4" />
              Continue editing
            </MobileActionButton>
            <MobileActionButton variant="primary" className="sn-mobile-preview-footer-primary" onClick={onPublish}>
              <Upload className="size-4" />
              Publish
            </MobileActionButton>
          </div>
        </div>
      </div>
    </MobilePageSurface>
  );
}

export function MobilePublishResultPage({
  success,
  publicUrl,
  onOpenWebsite,
  onCopyLink,
  onContinueEditing,
  onAutoFix,
  onViewLogs,
}: {
  success: boolean;
  publicUrl: string;
  onOpenWebsite: () => void;
  onCopyLink: () => void;
  onContinueEditing: () => void;
  onAutoFix: () => void;
  onViewLogs: () => void;
}) {
  const [copyHint, setCopyHint] = useState<string | null>(null);

  useEffect(() => {
    if (!copyHint) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyHint(null);
    }, 1600);

    return () => window.clearTimeout(timeout);
  }, [copyHint]);

  async function handleCopyLink(): Promise<void> {
    await onCopyLink();
    setCopyHint('链接已复制');
  }

  return (
    <MobilePageSurface className="sn-mobile-result-page">
      <div className="sn-mobile-result-content">
        <div className={`sn-mobile-result-figure ${success ? 'is-success' : 'is-failure'}`}>
          <div className="sn-mobile-result-cloud is-left" />
          <div className="sn-mobile-result-cloud is-center" />
          <div className="sn-mobile-result-cloud is-right" />
          <div className={`sn-mobile-result-blob ${success ? 'is-success' : 'is-failure'}`}>
            {success ? <CheckCircle2 className="size-6" /> : <CircleAlert className="size-6" />}
          </div>
        </div>
        <div className="sn-mobile-result-title">{success ? '发布成功' : '发布失败'}</div>
        <div className="sn-mobile-result-copy">
          {success ? '你的网站已上线，全球都可以访问了！' : '部署过程中遇到了一些问题，但我们可以继续修复。'}
        </div>
        {success ? (
          <div className="sn-mobile-result-card sn-mobile-result-address-card">
            <div className="sn-mobile-result-label">线上地址</div>
            <div className="sn-mobile-result-address-row">
              <span>{publicUrl}</span>
              <button className="sn-mobile-result-copy-icon" type="button" onClick={handleCopyLink} aria-label="复制线上地址">
                <Copy className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="sn-mobile-result-card sn-mobile-result-reasons-card">
            <div className="sn-mobile-result-label">常见原因</div>
            <ul className="sn-mobile-result-bullet-list">
              <li>构建错误</li>
              <li>依赖安装失败</li>
              <li>配置文件问题</li>
            </ul>
          </div>
        )}
        <div className="sn-mobile-result-actions is-stacked">
          {success ? (
            <>
              <MobileActionButton variant="primary" onClick={onOpenWebsite}>
                <ArrowUpRight className="size-4" /> 打开网站
              </MobileActionButton>
              <MobileActionButton variant="secondary" onClick={handleCopyLink}>
                <Copy className="size-4" /> 复制链接
              </MobileActionButton>
              <MobileActionButton variant="secondary" onClick={onContinueEditing}>
                <Edit2 className="size-4" /> 继续编辑
              </MobileActionButton>
            </>
          ) : (
            <>
              <MobileActionButton variant="primary" onClick={onAutoFix}>
                <Zap className="size-4" /> ShipNow 自动修复
              </MobileActionButton>
              <MobileActionButton variant="secondary" onClick={onViewLogs}>
                <Info className="size-4" /> 查看日志
              </MobileActionButton>
              <MobileActionButton variant="secondary" onClick={onContinueEditing}>
                稍后再试
              </MobileActionButton>
            </>
          )}
        </div>
      </div>
      {copyHint ? (
        <div className="sn-mobile-result-toast" role="status" aria-live="polite">
          {copyHint}
        </div>
      ) : null}
    </MobilePageSurface>
  );
}
