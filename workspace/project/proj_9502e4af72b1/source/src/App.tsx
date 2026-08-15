import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { id: 'about', label: '简介' },
  { id: 'works', label: '作品' },
  { id: 'contact', label: '联系' },
];

const works = [
  {
    title: 'Pixel Forge',
    desc: '一款实时协作的像素艺术编辑器，支持多人同步绘制与图层管理。',
    tags: ['React', 'WebSocket', 'Canvas'],
    image: null,
    href: '#',
  },
  {
    title: 'Echo Board',
    desc: '极简主义看板工具，融合手势操作与本地优先的离线存储策略。',
    tags: ['TypeScript', 'IndexedDB', 'Gesture'],
    image: null,
    href: '#',
  },
  {
    title: 'Orbit UI',
    desc: '面向数据可视化的 React 组件库，提供开箱即用的图表与布局。',
    tags: ['React', 'D3.js', 'Storybook'],
    image: null,
    href: '#',
  },
  {
    title: 'Timbre',
    desc: '基于 Web Audio API 的在线音色合成器，支持波形编辑与效果链。',
    tags: ['Web Audio', 'WASM', 'React'],
    image: null,
    href: '#',
  },
];

function App() {
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    document.title = 'Lynn | 个人主页';

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.2, rootMargin: '-80px 0px 0px 0px' }
    );

    document.querySelectorAll('.section-animate').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[rgb(var(--line))] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <span className="text-sm font-semibold text-[rgb(var(--ink))]">Lynn</span>
          <div className="flex gap-6 text-sm">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`relative transition hover:text-[rgb(var(--teal))] ${
                  activeSection === item.id
                    ? 'text-[rgb(var(--teal))]'
                    : 'text-[rgb(var(--muted))]'
                }`}
              >
                {item.label}
                <span
                  className={`absolute -bottom-[15px] left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-[rgb(var(--teal))] transition-transform duration-200 ${
                    activeSection === item.id ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </a>
            ))}
          </div>
        </div>
      </nav>

      <main className="page-shell pt-20">
        {/* Hero / About */}
        <section id="about" className="card section-animate flex flex-col gap-6 p-6 md:p-10">
          <div className="flex flex-col gap-2">
            <div className="pill border-[rgba(19,132,111,0.22)] bg-[rgba(19,132,111,0.08)] text-[rgb(var(--teal))] w-fit">
              Hey there 👋
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-[rgb(var(--ink))] md:text-5xl">
              Lynn
            </h1>
            <p className="text-lg text-[rgb(var(--muted))] md:text-xl">
              全栈开发者 · 设计爱好者
            </p>
          </div>

          <p className="max-w-2xl text-base leading-7 text-[rgb(var(--muted))] md:text-lg">
            热衷于构建优雅、实用的数字产品。擅长 React 生态系统与交互式 Web 应用开发，
            对前端工程化、数据可视化和创意编程抱有持续的好奇心。
          </p>

          <div className="flex flex-wrap gap-3">
            <a className="primary-button" href="#works">查看作品</a>
            <a className="soft-button" href="#contact">联系我</a>
            <a className="soft-button" href="#" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </section>

        {/* Works */}
        <section id="works" className="mt-10 section-animate">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight text-[rgb(var(--ink))]">作品</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {works.map((w, i) => (
              <a
                key={w.title}
                href={w.href}
                className="card-item card group flex flex-col overflow-hidden"
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div className="card-image-bg flex aspect-[16/9] items-center justify-center bg-[rgb(var(--line))]/30">
                  {w.image ? (
                    <img src={w.image} alt={w.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="card-image-letter text-3xl font-bold tracking-tight text-[rgb(var(--line))]">{w.title[0]}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 p-5">
                  <h3 className="text-lg font-semibold text-[rgb(var(--ink))] group-hover:text-[rgb(var(--teal))] transition-colors">
                    {w.title}
                  </h3>
                  <p className="text-sm leading-6 text-[rgb(var(--muted))]">{w.desc}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {w.tags.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="card section-animate mt-10 p-6 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-semibold tracking-tight text-[rgb(var(--ink))]">联系我</h2>
              <p className="max-w-md text-sm leading-6 text-[rgb(var(--muted))]">
                如果有合作意向或任何想法，欢迎随时联系。我通常会在 24 小时内回复。
              </p>
              <div className="flex flex-col gap-2 text-sm">
                <span className="flex items-center gap-2 text-[rgb(var(--muted))]">
                  <span className="text-[rgb(var(--ink))]">✉</span>
                  hello@lynn.dev
                </span>
                <span className="flex items-center gap-2 text-[rgb(var(--muted))]">
                  <span className="text-[rgb(var(--ink))]">✱</span>
                  @lynn
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <a className="primary-button" href="mailto:hello@lynn.dev">发送邮件</a>
              <a className="soft-button" href="#" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 border-t border-[rgb(var(--line))] py-6 text-center text-xs text-[rgb(var(--muted))]">
          &copy; {new Date().getFullYear()} Lynn. Built with React & Tailwind CSS.
        </footer>
      </main>
    </>
  );
}

export default App;
