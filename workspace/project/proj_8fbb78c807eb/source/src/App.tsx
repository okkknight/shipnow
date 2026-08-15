import { useEffect, useRef, useState } from 'react';
import { projectConfig } from './project.config';

const domains = [
  {
    icon: '⚔',
    title: '代码',
    desc: '构建可靠、优雅的数字产物，每一行都是锤炼过的。',
  },
  {
    icon: '✦',
    title: '创意',
    desc: '从概念到落地，把想法雕琢成可触达的作品。',
  },
  {
    icon: '⋆',
    title: '探索',
    desc: '保持对未知的好奇，在技术与想象力的边界漫游。',
  },
] as const;

/* ── Shooting Stars ── */
function ShootingStars() {
  const [stars, setStars] = useState<Array<{ id: number; left: number; top: number; angle: number; duration: number }>>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const spawn = () => {
      const id = ++idRef.current;
      setStars(prev => [
        ...prev,
        {
          id,
          left: Math.random() * 100,
          top: Math.random() * 35,
          angle: -25 + Math.random() * 15,
          duration: 1.2 + Math.random() * 1.2,
        },
      ]);
      setTimeout(() => {
        setStars(prev => prev.filter(s => s.id !== id));
      }, 3000);
    };

    const t = setInterval(spawn, 2000 + Math.random() * 4000);
    // spawn one immediately
    setTimeout(spawn, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="shooting-star-field" aria-hidden="true">
      {stars.map(s => (
        <span
          key={s.id}
          className="shooting-star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            transform: `rotate(${s.angle}deg)`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function App() {
  useEffect(() => {
    document.title = projectConfig.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', projectConfig.prompt);
    }
  }, []);

  return (
    <div className="page-shell">
      {/* Hero */}
      <section className="hero-section">
        {/* Deep layer — tiny dim stars */}
        <div className="star-field-layer star-field-deep" aria-hidden="true">
          {Array.from({ length: 100 }, (_, i) => (
            <span
              key={`d-${i}`}
              className="star star-tiny"
              style={{
                left: `${(i * 37.7 + 13.3) % 100}%`,
                top: `${(i * 71.3 + 7.7) % 100}%`,
                animationDelay: `${(i * 0.23) % 8}s`,
                animationDuration: `${5 + (i % 5) * 1.2}s`,
              }}
            />
          ))}
        </div>

        {/* Mid layer — medium twinkling stars */}
        <div className="star-field-layer star-field-mid" aria-hidden="true">
          {Array.from({ length: 50 }, (_, i) => (
            <span
              key={`m-${i}`}
              className="star star-medium"
              style={{
                left: `${(i * 53.1 + 29.7) % 100}%`,
                top: `${(i * 88.7 + 11.3) % 100}%`,
                animationDelay: `${(i * 0.37) % 7}s`,
                animationDuration: `${3 + (i % 4) * 1.1}s`,
              }}
            />
          ))}
        </div>

        {/* Close layer — few bright golden stars */}
        <div className="star-field-layer star-field-close" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={`c-${i}`}
              className="star star-large"
              style={{
                left: `${(i * 41.9 + 67.1) % 100}%`,
                top: `${(i * 23.7 + 89.4) % 100}%`,
                animationDelay: `${(i * 0.61) % 10}s`,
                animationDuration: `${4 + (i % 3) * 1.5}s`,
              }}
            />
          ))}
        </div>

        <ShootingStars />

        <div className="hero-content">
          <div className="hero-badge">KnightSpace</div>

          <h1 className="hero-title">
            Knight
            <span className="text-[rgb(var(--gold))]">Space</span>
          </h1>

          <p className="hero-subtitle">
            骑士的个人空间 —— 在代码、创意与星辰之间，<br />
            构建属于自己的领地。
          </p>

          <div className="hero-actions">
            <a className="primary-button" href="#domains">
              探索领域
            </a>
            <a className="ghost-button" href="#contact">
              建立连接
            </a>
          </div>
        </div>

        <div className="scroll-hint" aria-hidden="true">
          <span className="scroll-dot" />
        </div>
      </section>

      {/* Domains */}
      <section id="domains" className="section">
        <div className="section-header">
          <span className="section-pill">领地</span>
          <h2 className="section-title">探索的疆域</h2>
          <p className="section-desc">
            每一个方向都是一片值得深耕的土地。
          </p>
        </div>

        <div className="domain-grid">
          {domains.map((d) => (
            <article key={d.title} className="domain-card">
              <span className="domain-icon">{d.icon}</span>
              <h3 className="domain-title">{d.title}</h3>
              <p className="domain-desc">{d.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Manifesto */}
      <section className="section manifesto-section">
        <figure className="manifesto-card">
          <blockquote className="manifesto-quote">
            "不是所有的骑士都骑在马上 —— 有些骑士坐在屏幕前，<br />
            用键盘敲出属于这个时代的骑士精神。"
          </blockquote>
          <figcaption className="manifesto-caption">
            — Knight, <cite>KnightSpace 宣言</cite>
          </figcaption>
        </figure>
      </section>

      {/* Contact */}
      <section id="contact" className="section contact-section">
        <div className="section-header">
          <span className="section-pill">连接</span>
          <h2 className="section-title">建立连接</h2>
          <p className="section-desc">
            无论你是同行者、合作者，还是路过的好奇旅人。
          </p>
        </div>

        <div className="contact-grid">
          <a className="contact-card" href="mailto:okkknight@gmail.com">
            <span className="contact-label">邮件</span>
            <span className="contact-value">okkknight@gmail.com</span>
          </a>
          <a className="contact-card" href="https://github.com" target="_blank" rel="noopener noreferrer">
            <span className="contact-label">GitHub</span>
            <span className="contact-value">@knight</span>
          </a>
          <div className="contact-card dim">
            <span className="contact-label">状态</span>
            <span className="contact-value">
              <span className="status-dot" />
              探索中
            </span>
          </div>
        </div>

        <div className="back-top">
          <a className="ghost-button" href="#top">
            返回星空
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>
          © {new Date().getFullYear()} <span className="footer-brand">KnightSpace</span>
        </p>
        <p className="footer-tagline">Built for ShipNow · 以骑士之名</p>
      </footer>
    </div>
  );
}

export default App;
