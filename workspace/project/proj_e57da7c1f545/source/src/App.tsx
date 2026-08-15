import { useEffect } from 'react';
import StarField from './components/StarField';

const projects = [
  {
    title: 'Project Nebula',
    desc: 'A real-time collaborative whiteboard powered by WebSocket and CRDT.',
    tags: ['React', 'Node.js', 'CRDT'],
    color: 'from-emerald-500/20 to-teal-500/10',
  },
  {
    title: 'Flux Dashboard',
    desc: 'An obsessively designed analytics dashboard with sub-100ms query response.',
    tags: ['Vue', 'Rust', 'ClickHouse'],
    color: 'from-amber-500/20 to-orange-500/10',
  },
  {
    title: 'Echo CLI',
    desc: 'A terminal-based note-taking tool with fuzzy search and git-backed sync.',
    tags: ['Go', 'Bubble Tea', 'SQLite'],
    color: 'from-sky-500/20 to-blue-500/10',
  },
  {
    title: 'Toki',
    desc: 'Minimalist i18n library with runtime-less compile-time extraction.',
    tags: ['TypeScript', 'AST'],
    color: 'from-violet-500/20 to-purple-500/10',
  },
];

const socialLinks = [
  { label: 'GitHub', href: '#' },
  { label: 'Twitter / X', href: '#' },
  { label: 'LinkedIn', href: '#' },
  { label: 'hello@knight.dev', href: 'mailto:hello@knight.dev', primary: true },
];

const navItems = [
  { label: '简介', href: '#intro' },
  { label: '作品', href: '#works' },
  { label: '联系', href: '#contact' },
];

function App() {
  useEffect(() => {
    document.title = 'Knight · 个人主页';
  }, []);

  return (
    <>
      <StarField />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[rgb(var(--line))]/50 bg-[rgb(var(--bg))]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 md:px-8">
          <span className="text-sm font-semibold tracking-tight text-[rgb(var(--ink))]">Knight</span>
          <div className="flex items-center gap-6">
            {navItems.map((item) => (
              <a key={item.href} className="nav-link" href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <main className="page-shell">
        {/* Spacer for fixed nav */}
        <div className="h-14" />

        {/* ============ HERO / 简介 ============ */}
        <section id="intro" className="flex min-h-[70vh] flex-col justify-center">
          <div className="fade-in">
            <span className="section-title">INTRODUCTION</span>
          </div>
          <h1 className="fade-in fade-in-d1 mt-4 text-4xl font-semibold tracking-tight text-[rgb(var(--ink))] md:text-6xl">
            你好，我是 <span className="text-[rgb(var(--teal))]">Knight</span>
          </h1>
          <p className="fade-in fade-in-d2 mt-4 max-w-2xl text-base leading-7 text-[rgb(var(--muted))] md:text-lg">
            一名热爱技术与设计的全栈开发者。专注于构建美观、高性能的 Web 应用，
            善于将复杂问题转化为简洁直观的解决方案。
            目前主要钻研 React 生态、Rust 后端与实时系统。
          </p>
          <div className="fade-in fade-in-d3 mt-6 flex flex-wrap gap-3">
            <a className="primary-button" href="#works">
              查看作品
            </a>
            <a className="soft-button" href="#contact">
              联系我
            </a>
          </div>
        </section>

        {/* ============ WORKS / 作品 ============ */}
        <section id="works" className="py-20 md:py-28">
          <div className="fade-in">
            <span className="section-title">WORKS</span>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[rgb(var(--ink))] md:text-3xl">
              精选作品
            </h2>
            <p className="mt-2 text-sm leading-6 text-[rgb(var(--muted))]">
              以下是一些我参与或主导的项目 —— 点击可了解更多。
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {projects.map((project, i) => (
              <a key={project.title} href="#" className={`project-card fade-in ${[null, 'fade-in-d1', 'fade-in-d2', 'fade-in-d3'][i] ?? ''}`}>
                {/* Project thumbnail placeholder */}
                <div
                  className={`h-36 w-full rounded-xl bg-gradient-to-br ${project.color} flex items-center justify-center`}
                >
                  <span className="text-3xl font-bold tracking-tight text-[rgb(var(--ink))]/20">
                    {project.title.charAt(0)}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-[rgb(var(--ink))]">{project.title}</h3>
                <p className="text-sm leading-6 text-[rgb(var(--muted))]">{project.desc}</p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ============ CONTACT / 联系 ============ */}
        <section id="contact" className="py-20 md:py-28">
          <div className="fade-in">
            <span className="section-title">CONTACT</span>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[rgb(var(--ink))] md:text-3xl">
              保持联系
            </h2>
            <p className="mt-2 text-sm leading-6 text-[rgb(var(--muted))]">
              无论是有趣的项目想法，还是只是想打个招呼 —— 欢迎随时联系。
            </p>
          </div>

          <div className="fade-in fade-in-d1 mt-8 flex flex-wrap gap-3">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={link.primary ? 'primary-button' : 'contact-link'}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Simple contact form */}
          <div className="fade-in fade-in-d2 card mt-10 p-6 md:p-8">
            <h3 className="text-sm font-semibold text-[rgb(var(--ink))]">发送消息</h3>
            <form className="mt-4 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  className="rounded-xl border border-[rgb(var(--line))] bg-white/60 px-4 py-2.5 text-sm outline-none transition focus:border-[rgb(var(--teal))] focus:ring-2 focus:ring-[rgb(var(--teal))]/20"
                  placeholder="你的名字"
                  type="text"
                />
                <input
                  className="rounded-xl border border-[rgb(var(--line))] bg-white/60 px-4 py-2.5 text-sm outline-none transition focus:border-[rgb(var(--teal))] focus:ring-2 focus:ring-[rgb(var(--teal))]/20"
                  placeholder="邮箱地址"
                  type="email"
                />
              </div>
              <textarea
                className="rounded-xl border border-[rgb(var(--line))] bg-white/60 px-4 py-2.5 text-sm outline-none transition focus:border-[rgb(var(--teal))] focus:ring-2 focus:ring-[rgb(var(--teal))]/20"
                placeholder="说点什么..."
                rows={4}
              />
              <div>
                <button className="primary-button" type="submit">
                  发送
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="mt-10 border-t border-[rgb(var(--line))]/50 py-6 text-center text-xs text-[rgb(var(--muted))]">
          &copy; {new Date().getFullYear()} Knight. Built with React &amp; Tailwind CSS.
        </footer>
      </main>
    </>
  );
}

export default App;
