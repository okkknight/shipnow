import { useEffect, useMemo, useRef, useState } from 'react';
import { projectConfig } from './project.config';

function useProjectMetadata() {
  return useMemo(
    () => ({
      projectId: projectConfig.projectId,
      displayName: projectConfig.displayName,
      publicHandle: projectConfig.publicHandle,
      title: projectConfig.title,
      subtitle: projectConfig.prompt,
      type: projectConfig.type,
    }),
    []
  );
}

function App() {
  const config = useProjectMetadata();

  useEffect(() => {
    document.title = config.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', config.subtitle);
    }
  }, [config]);

  if (config.type === 'game') {
    return <GameTemplate title={config.title} subtitle={config.subtitle} />;
  }

  return (
    <LandingTemplate
      title={config.title}
      subtitle={config.subtitle}
      displayName={config.displayName}
      publicHandle={config.publicHandle}
      projectId={config.projectId}
    />
  );
}

type GamePhase = 'ready' | 'playing' | 'result';

function buildGameResultLine(score: number): string {
  if (score >= 5) {
    return '功德直接拉满，篮筐今天也要给你鼓掌。';
  }
  if (score >= 3) {
    return '手感已经在线，再来两球就能把梗打满。';
  }
  if (score >= 1) {
    return '第一桶金已经到账，下一球继续加功德。';
  }
  return '先把节奏蓄起来，下一次出手就是高光。';
}

function buildGameShareText(title: string, score: number, shots: number, bestPower: number): string {
  return [
    `${title} - 我拿到 ${score} 分，${shots}/5 球，最高蓄力 ${bestPower}%`,
    buildGameResultLine(score),
    'ShipNow 功德篮球现场直出，支持复制分享。',
  ].join('\n');
}

function LandingTemplate({
  title,
  subtitle,
  displayName,
  publicHandle,
  projectId,
}: {
  title: string;
  subtitle: string;
  displayName: string;
  publicHandle: string;
  projectId: string;
}) {
  return (
    <div className="page-shell">
      <header className="card flex flex-col gap-8 overflow-hidden p-6 md:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="pill border-[rgba(19,132,111,0.22)] bg-[rgba(19,132,111,0.08)] text-[rgb(var(--teal))]">
            ShipNow template
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[rgb(var(--ink))] md:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[rgb(var(--muted))] md:text-lg">{subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="primary-button">Launch demo</button>
            <button className="soft-button">Share project</button>
          </div>
        </div>

        <div className="grid min-w-[280px] gap-3 rounded-[24px] border border-[rgb(var(--line))] bg-[rgb(251 249 246)] p-4">
          <Stat label="Project" value={displayName} />
          <Stat label="Handle" value={publicHandle} />
          <Stat label="Project ID" value={projectId} />
          <Stat label="Type" value={projectConfig.type} />
          <Stat label="Template" value="default-static-site" />
        </div>
      </header>

      <main className="mt-6 grid gap-4 lg:grid-cols-3">
        <FeatureCard
          title="Editorial layout"
          description="A strong first viewport, compact sections, and clean typographic rhythm that feels ready to ship."
        />
        <FeatureCard
          title="Responsive by default"
          description="The template stays legible on mobile, tablet, and desktop without requiring structural changes."
        />
        <FeatureCard
          title="ShipNow-friendly"
          description="Codex can safely update this template without introducing dependencies or backend logic."
        />
      </main>

      <footer className="mt-auto pt-8 text-sm text-[rgb(var(--muted))]">
        Built for ShipNow · <span className="font-medium text-[rgb(var(--ink))]">{name}</span>
      </footer>
    </div>
  );
}

function GameTemplate({ title, subtitle }: { title: string; subtitle: string }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<import('phaser').Game | null>(null);
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(0);
  const [bestPower, setBestPower] = useState(0);
  const [lastPower, setLastPower] = useState(0);
  const [copyStatus, setCopyStatus] = useState('');
  const maxShots = 5;
  const remaining = Math.max(0, maxShots - shots);
  const shareText = useMemo(() => buildGameShareText(title, score, shots, bestPower), [title, score, shots, bestPower]);

  useEffect(() => {
    if (phase !== 'playing' || !stageRef.current) {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      return;
    }

    let disposed = false;
    let game: import('phaser').Game | null = null;

    void import('phaser').then((module) => {
      if (disposed || !stageRef.current) {
        return;
      }

      const PhaserModule = module.default;
      const spawn = { x: 130, y: 414 };
      const rim = { x: 768, y: 168 };
      const session = {
        score: 0,
        attempts: 0,
        bestPower: 0,
        charge: 0,
        charging: false,
        shotActive: false,
        scoredThisShot: false,
        finished: false,
        ball: null as import('phaser').Physics.Arcade.Image | null,
        scoreLabel: null as import('phaser').GameObjects.Text | null,
        attemptsLabel: null as import('phaser').GameObjects.Text | null,
        chargeLabel: null as import('phaser').GameObjects.Text | null,
        meterFill: null as import('phaser').GameObjects.Rectangle | null,
        resultLabel: null as import('phaser').GameObjects.Text | null,
        resetTimer: null as import('phaser').Time.TimerEvent | null,
      };

      const refreshHud = (scene: import('phaser').Scene): void => {
        session.scoreLabel?.setText(`功德 ${session.score}`);
        session.attemptsLabel?.setText(`出手 ${session.attempts}/${maxShots}`);
        session.chargeLabel?.setText(session.charging ? `蓄力 ${Math.round(session.charge * 100)}%` : '按住蓄力，松手出手');
        session.meterFill?.setScale(Math.max(0.04, session.charge), 1);
        session.resultLabel?.setText(buildGameResultLine(session.score));
        if (!session.charging) {
          scene.cameras.main.setBackgroundColor('#f7f0e3');
        }
      };

      const completeShot = (scene: import('phaser').Scene): void => {
        if (!session.ball || !session.shotActive || session.finished) {
          return;
        }

        session.shotActive = false;
        session.charging = false;
        session.ball.setVelocity(0, 0);
        session.ball.setAngularVelocity(0);
        session.ball.setPosition(spawn.x, spawn.y);
        session.ball.setActive(true).setVisible(true);
        session.resetTimer?.remove(false);
        session.resetTimer = null;

        if (session.attempts >= maxShots) {
          session.finished = true;
          game?.destroy(true);
          gameRef.current = null;
          setScore(session.score);
          setShots(session.attempts);
          setBestPower(session.bestPower);
          setLastPower(0);
          setCopyStatus('');
          setPhase('result');
          return;
        }

        refreshHud(scene);
      };

      class MainScene extends PhaserModule.Scene {
        create() {
          const bg = this.add.graphics();
          bg.fillStyle(0xf8f2e8, 1);
          bg.fillRect(0, 0, 960, 540);
          bg.fillStyle(0xeddfcf, 1);
          bg.fillRoundedRect(22, 22, 916, 496, 28);
          bg.fillStyle(0xd7c7b0, 0.55);
          bg.fillRoundedRect(44, 370, 872, 96, 24);
          bg.lineStyle(4, 0xb79874, 0.35);
          bg.strokeRoundedRect(44, 370, 872, 96, 24);

          const ballGraphics = this.add.graphics();
          ballGraphics.fillStyle(0xf0b15d, 1);
          ballGraphics.fillCircle(18, 18, 18);
          ballGraphics.lineStyle(3, 0xa45b18, 0.95);
          ballGraphics.strokeCircle(18, 18, 17);
          ballGraphics.generateTexture('game-ball', 36, 36);
          ballGraphics.destroy();

          const hoopGraphics = this.add.graphics();
          hoopGraphics.lineStyle(8, 0xcf6d2f, 1);
          hoopGraphics.strokeRect(724, 120, 108, 22);
          hoopGraphics.fillStyle(0x2c3440, 1);
          hoopGraphics.fillRect(730, 106, 8, 50);
          hoopGraphics.fillRect(818, 106, 8, 50);
          hoopGraphics.lineStyle(3, 0x2c3440, 0.85);
          hoopGraphics.strokeRoundedRect(704, 150, 148, 76, 18);
          hoopGraphics.generateTexture('game-hoop', 900, 260);
          hoopGraphics.destroy();

          const hoop = this.add.image(rim.x, 182, 'game-hoop').setOrigin(0.5, 0.5);
          hoop.setDisplaySize(214, 160);

          this.add.text(40, 34, title, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '32px',
            color: '#18222d',
            fontStyle: '700',
          });
          this.add.text(40, 76, subtitle, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '17px',
            color: '#566074',
            wordWrap: { width: 540 },
          });
          this.add.text(40, 144, '按住屏幕或鼠标蓄力，松手投篮。五次出手后进入结算。', {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '15px',
            color: '#7a5b2d',
          });

          session.scoreLabel = this.add.text(40, 198, '功德 0', {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '28px',
            color: '#18222d',
            fontStyle: '700',
          });
          session.attemptsLabel = this.add.text(40, 238, `出手 0/${maxShots}`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '16px',
            color: '#566074',
          });
          session.chargeLabel = this.add.text(40, 272, '按住蓄力，松手出手', {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '16px',
            color: '#566074',
          });
          session.resultLabel = this.add.text(40, 316, buildGameResultLine(0), {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '16px',
            color: '#996017',
            wordWrap: { width: 400 },
          });

          const meterBg = this.add.rectangle(40, 352, 220, 18, 0xffffff, 0.76).setOrigin(0, 0.5);
          meterBg.setStrokeStyle(1, 0xd4c6b3, 1);
          session.meterFill = this.add.rectangle(40, 352, 220, 18, 0x19, 0.0).setOrigin(0, 0.5);
          session.meterFill.setFillStyle(0x13a58a, 1);
          this.add.text(270, 344, '蓄力条', {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
            color: '#7a5b2d',
            fontStyle: '700',
          });

          const ball = this.physics.add.image(spawn.x, spawn.y, 'game-ball');
          ball.setCircle(18);
          ball.setBounce(0.45);
          ball.setCollideWorldBounds(true);
          ball.setDrag(14, 14);
          ball.setMaxVelocity(1080, 1080);
          ball.setDepth(3);
          session.ball = ball;

          const sensor = this.add.rectangle(794, 178, 98, 30, 0xff0000, 0);
          this.physics.add.existing(sensor, true);
          this.physics.add.overlap(ball, sensor, () => {
            if (!session.shotActive || session.scoredThisShot || session.finished) {
              return;
            }
            session.scoredThisShot = true;
            session.score += 1;
            setScore(session.score);
            refreshHud(this);
            const burst = this.add.text(676, 96, '功德 +1', {
              fontFamily: 'Inter, Arial, sans-serif',
              fontSize: '20px',
              color: '#13a58a',
              fontStyle: '700',
            });
            this.tweens.add({
              targets: burst,
              y: 68,
              alpha: 0,
              duration: 600,
              ease: 'Sine.easeOut',
              onComplete: () => burst.destroy(),
            });
          });

          const shoot = (): void => {
            if (session.shotActive || session.charging || session.attempts >= maxShots || session.finished) {
              return;
            }

            session.charging = false;
            session.shotActive = true;
            session.attempts += 1;
            session.score = session.score;
            session.scoredThisShot = false;
            const power = PhaserModule.Math.Clamp(session.charge, 0.12, 1);
            const powerPercent = Math.round(power * 100);
            session.bestPower = Math.max(session.bestPower, powerPercent);
            setShots(session.attempts);
            setLastPower(powerPercent);
            setBestPower(session.bestPower);
            session.charge = 0;
            session.chargeLabel?.setText(`出手 ${session.attempts}/${maxShots}`);
            session.ball?.setPosition(spawn.x, spawn.y);
            session.ball?.setVelocity(360 + power * 560, -560 - power * 330);
            session.ball?.setAngularVelocity(320 * power);
            refreshHud(this);
            session.resetTimer?.remove(false);
            session.resetTimer = this.time.delayedCall(1650, () => {
              completeShot(this);
            });
          };

          const beginCharge = (): void => {
            if (session.shotActive || session.attempts >= maxShots || session.finished) {
              return;
            }
            session.charging = true;
            session.charge = 0;
            refreshHud(this);
          };

          const releaseCharge = (): void => {
            if (!session.charging) {
              return;
            }
            shoot();
          };

          this.input.on('pointerdown', beginCharge);
          this.input.on('pointerup', releaseCharge);
          this.input.on('pointerout', releaseCharge);
          this.input.keyboard?.on('keyup-SPACE', releaseCharge);

          this.events.once('shutdown', () => {
            session.resetTimer?.remove(false);
            this.input.off('pointerdown', beginCharge);
            this.input.off('pointerup', releaseCharge);
            this.input.off('pointerout', releaseCharge);
            this.input.keyboard?.off('keyup-SPACE', releaseCharge);
          });

          refreshHud(this);
        }

        update(_time: number, delta: number) {
          if (session.finished) {
            return;
          }

          if (session.charging) {
            session.charge = Math.min(1, session.charge + delta / 1100);
            session.meterFill?.setScale(Math.max(0.04, session.charge), 1);
            session.chargeLabel?.setText(`蓄力 ${Math.round(session.charge * 100)}%`);
          }

          if (session.ball && session.shotActive && !session.finished) {
            const ballBody = session.ball.body as import('phaser').Physics.Arcade.Body;
            if (session.ball.y > 650 || session.ball.x < -80 || session.ball.x > 1120 || ballBody.velocity.y > 780) {
              completeShot(this);
            }
          }
        }
      }

      game = new PhaserModule.Game({
        type: PhaserModule.AUTO,
        parent: stageRef.current,
        backgroundColor: '#f7f0e3',
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { y: 980 },
            debug: false,
          },
        },
        scale: {
          mode: PhaserModule.Scale.FIT,
          autoCenter: PhaserModule.Scale.CENTER_BOTH,
          width: 960,
          height: 540,
        },
        scene: MainScene,
      });

      gameRef.current = game;
    });

    return () => {
      disposed = true;
      game?.destroy(true);
      gameRef.current = null;
    };
  }, [phase, subtitle, title]);

  const startGame = (): void => {
    setPhase('playing');
    setScore(0);
    setShots(0);
    setBestPower(0);
    setLastPower(0);
    setCopyStatus('');
  };

  const copyShare = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyStatus('已复制分享文案');
    } catch {
      setCopyStatus('复制失败，请手动复制下方文案');
    }
  };

  return (
    <div className="page-shell">
      <section className="card overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="pill border-[rgba(191,116,25,0.22)] bg-[rgba(191,116,25,0.08)] text-[rgb(var(--amber))]">
              Phaser game
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[rgb(var(--muted))] md:text-lg">{subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="primary-button" onClick={startGame}>
                {phase === 'result' ? '再来一局' : '开始投篮'}
              </button>
              <button className="soft-button" onClick={copyShare} disabled={phase !== 'result'}>
                复制分享结果
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <GameMetric label="功德" value={`${score}`} />
              <GameMetric label="出手" value={`${shots}/5`} />
              <GameMetric label="最高蓄力" value={`${bestPower}%`} />
            </div>
          </div>

          <div className="grid min-w-[280px] gap-3 rounded-[24px] border border-[rgb(var(--line))] bg-[rgb(251 249 246)] p-4 shadow-[0_20px_40px_rgba(18,23,31,0.05)]">
            <Stat label="Game" value="功德篮球" />
            <Stat label="Mode" value="按住蓄力 / 松手投篮" />
            <Stat label="Result" value={phase === 'result' ? buildGameResultLine(score) : '投满 5 球后自动结算'} />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] border border-[rgb(var(--line))] bg-[#f7f0e3]">
          <div className="relative">
            <div ref={stageRef} className="min-h-[460px] w-full" />

            {phase !== 'playing' ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[rgba(247,240,227,0.76)] px-6 text-center backdrop-blur-[2px]">
                <div className="max-w-xl rounded-[28px] border border-[rgb(var(--line))] bg-white/90 p-6 shadow-[0_20px_50px_rgba(18,23,31,0.08)]">
                  <div className="pill border-[rgba(21,128,110,0.22)] bg-[rgba(21,128,110,0.08)] text-[rgb(var(--teal))]">
                    {phase === 'result' ? '结算完成' : '开始页面'}
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                    {phase === 'result' ? `本局功德 ${score}` : '准备好开始蓄力了吗'}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[rgb(var(--muted))]">
                    {phase === 'result'
                      ? `${buildGameResultLine(score)} 这句梗也可以复制分享给朋友。`
                      : '按住屏幕、鼠标或空格开始蓄力，松手把球送进篮筐。五次出手后自动结算。'}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <button className="primary-button" onClick={startGame}>
                      {phase === 'result' ? '再打一局' : '开始投篮'}
                    </button>
                    {phase === 'result' ? (
                      <button className="soft-button" onClick={copyShare}>
                        复制分享文案
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-5 grid gap-2 text-left text-xs text-[rgb(var(--muted))] sm:grid-cols-2">
                    <div className="rounded-2xl border border-[rgb(var(--line))] bg-[rgb(255,252,248)] px-3 py-2">
                      <span className="font-semibold text-[rgb(var(--ink))]">出手规则</span>
                      <div className="mt-1">最多 5 球，优先稳节奏。</div>
                    </div>
                    <div className="rounded-2xl border border-[rgb(var(--line))] bg-[rgb(255,252,248)] px-3 py-2">
                      <span className="font-semibold text-[rgb(var(--ink))]">分享结果</span>
                      <div className="mt-1">结算页可直接复制梗文案。</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {phase === 'playing' ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 px-5 py-4">
                <div className="rounded-2xl border border-[rgb(var(--line))] bg-white/90 px-4 py-3 shadow-[0_12px_30px_rgba(18,23,31,0.08)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Current</div>
                  <div className="mt-1 text-sm font-semibold text-[rgb(var(--ink))]">{buildGameResultLine(score)}</div>
                </div>
                <div className="rounded-2xl border border-[rgb(var(--line))] bg-white/90 px-4 py-3 shadow-[0_12px_30px_rgba(18,23,31,0.08)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Power</div>
                  <div className="mt-1 text-sm font-semibold text-[rgb(var(--ink))]">{lastPower}%</div>
                </div>
                <div className="rounded-2xl border border-[rgb(var(--line))] bg-white/90 px-4 py-3 shadow-[0_12px_30px_rgba(18,23,31,0.08)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Shots left</div>
                  <div className="mt-1 text-sm font-semibold text-[rgb(var(--ink))]">{remaining}</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {phase === 'result' ? (
          <div className="mt-6 rounded-[24px] border border-[rgb(var(--line))] bg-[rgb(255,252,248)] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="label">Share copy</p>
                <p className="mt-2 text-sm leading-6 text-[rgb(var(--muted))]">{shareText}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button className="soft-button" onClick={copyShare}>
                  复制分享结果
                </button>
                <button className="primary-button" onClick={startGame}>
                  再打一局
                </button>
              </div>
            </div>
            {copyStatus ? <p className="mt-3 text-sm text-[rgb(var(--teal))]">{copyStatus}</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function GameMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[rgb(var(--line))] bg-white/85 px-4 py-3 shadow-[0_10px_24px_rgba(18,23,31,0.05)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[rgb(var(--ink))]">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[rgb(var(--line))] bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">{label}</div>
      <div className="mt-1 font-medium text-[rgb(var(--ink))]">{value}</div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <article className="card p-5">
      <div className="text-sm font-semibold text-[rgb(var(--teal))]">Feature</div>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[rgb(var(--muted))]">{description}</p>
    </article>
  );
}

export default App;
