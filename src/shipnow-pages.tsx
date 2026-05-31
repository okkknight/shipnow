import { ArrowUpRight, CheckCircle2, CircleAlert, Copy, Edit2, Info, Share2, Sparkles, Upload, Zap, ChevronLeft } from 'lucide-react';
import { MobileActionButton, MobilePageSurface } from './shipnow-real-ui';

export function MobilePreviewPage({
  projectName,
  frameUrl,
  onBackEdit,
  onShare,
  onPublish,
  mode = 'preview',
  embedded = false,
}: {
  projectName: string;
  frameUrl: string;
  onBackEdit: () => void;
  onShare?: () => void;
  onPublish?: () => void;
  mode?: 'preview' | 'live';
  embedded?: boolean;
}) {
  const isLiveMode = mode === 'live';

  return (
    <MobilePageSurface className={`sn-mobile-preview-page ${embedded ? 'sn-mobile-preview-page-embedded' : ''}`.trim()}>
      <div className="sn-mobile-preview-visual">
        <header className="sn-mobile-preview-nav">
          <button className="sn-mobile-preview-nav-icon" type="button" aria-label="返回" onClick={onBackEdit}>
            <ChevronLeft className="size-5" />
          </button>
          <div className="sn-mobile-preview-nav-copy">
            <div className="sn-mobile-preview-nav-title">{projectName}</div>
            <span className="sn-mobile-preview-inline-status">{isLiveMode ? '正式站点' : '预览中'}</span>
          </div>
        </header>

        <div className="sn-mobile-preview-body">
          <div className="sn-mobile-preview-frame-shell">
            <iframe
              className="sn-mobile-preview-frame"
              src={frameUrl}
              title={`${projectName} ${isLiveMode ? '正式站点' : '预览'}`}
              loading="eager"
            />
          </div>

          <div className="sn-mobile-preview-footer-actions">
            {isLiveMode ? (
              <>
                {onShare ? (
                  <MobileActionButton variant="primary" className="sn-mobile-preview-footer-primary" onClick={onShare}>
                    <Share2 className="size-4" />
                    分享
                  </MobileActionButton>
                ) : null}
                <MobileActionButton variant="secondary" className="sn-mobile-preview-footer-secondary" onClick={onBackEdit}>
                  <Sparkles className="size-4" />
                  继续编辑
                </MobileActionButton>
              </>
            ) : (
              <>
                <MobileActionButton variant="secondary" className="sn-mobile-preview-footer-secondary" onClick={onBackEdit}>
                  <Sparkles className="size-4" />
                  继续编辑
                </MobileActionButton>
                {onPublish ? (
                  <MobileActionButton variant="primary" className="sn-mobile-preview-footer-primary" onClick={onPublish}>
                    <Upload className="size-4" />
                    发布
                  </MobileActionButton>
                ) : null}
              </>
            )}
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
  async function handleCopyLink(): Promise<void> {
    await onCopyLink();
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
    </MobilePageSurface>
  );
}
