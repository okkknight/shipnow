import { useEffect } from 'react';
import { projectConfig } from './project.config';

function App() {
  const { displayName, publicHandle, projectId, prompt, title } = projectConfig;

  useEffect(() => {
    document.title = title;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', prompt);
    }
  }, [prompt, title]);

  return (
    <main id="top" className="page-shell">
      <section className="card flex flex-col gap-6 p-6 md:p-8">
        <div className="pill border-[rgba(19,132,111,0.22)] bg-[rgba(19,132,111,0.08)] text-[rgb(var(--teal))]">
          ShipNow starter
        </div>

        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-[rgb(var(--ink))] md:text-6xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[rgb(var(--muted))] md:text-lg">{prompt}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <InfoCard label="Project" value={displayName} />
          <InfoCard label="Handle" value={publicHandle} />
          <InfoCard label="Project ID" value={projectId} />
        </div>
      </section>

      <section className="card mt-6 p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[rgb(var(--teal))]">Source-first workflow</p>
            <p className="mt-2 text-sm leading-6 text-[rgb(var(--muted))]">
              Edit only <span className="font-medium text-[rgb(var(--ink))]">source/</span> to shape the site. ShipNow will
              build, preview, and publish the generated output for you.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a className="primary-button" href="#top">
              Continue editing
            </a>
            <a className="soft-button" href="#structure">
              View structure
            </a>
          </div>
        </div>

        <div
          id="structure"
          className="mt-6 grid gap-3 rounded-[24px] border border-[rgb(var(--line))] bg-[rgb(255,252,248)] p-4 md:grid-cols-2"
        >
          <DetailRow label="Editable" value="source/src, source/index.html, source/package.json, source/vite.config.ts" />
          <DetailRow label="Managed by ShipNow" value="preview/, releases/, current-preview/, current-public/, logs/" />
          <DetailRow label="Build output" value="pnpm build -> dist -> automatic preview/public release copy" />
          <DetailRow label="If you add deps" value="update source/package.json and let pnpm install / build handle the lockfile" />
        </div>
      </section>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[rgb(var(--line))] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(18,23,31,0.05)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[rgb(var(--ink))]">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[rgb(var(--line))] bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">{label}</div>
      <div className="mt-1 text-sm font-medium leading-6 text-[rgb(var(--ink))]">{value}</div>
    </div>
  );
}

export default App;
