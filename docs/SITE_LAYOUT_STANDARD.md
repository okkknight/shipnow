# Site Layout Standard

This document defines the on-disk layout for ShipNow-managed sites under `/opt/boringmax/site`.

## Top-level rule

- Every direct child of `/opt/boringmax/site` is a site.
- There is no shared top-level `releases/`, `projects/`, `logs/`, or `.shipnow/` directory under `/opt/boringmax/site`.
- A site owns all of its own source, build snapshots, logs, and current public entrypoints.

## Per-site layout

For a site named `test`, the canonical layout is:

```text
/opt/boringmax/site/test/
  index.html
  assets/
  preview/
    index.html
    assets/
  source/
  releases/
    preview/
    public/
  logs/
  current-preview
  current-public
```

## What each entry means

- `index.html` and `assets/` are the current public entrypoint for `https://boringmax.com/test`
- `preview/index.html` and `preview/assets/` are the current preview entrypoint for `https://shipnow.boringmax.com/preview/test`
- `source/` is the editable working tree that Codex modifies
- `releases/preview/` stores immutable preview snapshots
- `releases/public/` stores immutable public snapshots
- `logs/` stores task logs
- `current-preview` and `current-public` are internal symlink targets that point at the current release snapshot

## Operational rule

- ShipNow may create, update, and delete site directories.
- ShipNow must not rely on a global shared workspace for managed site assets.
- If ShipNow disappears, the already published `index.html` and `assets/` under each site directory must still be servable by Caddy.

## Why this layout exists

- It keeps each site independently runnable.
- It avoids a single global bucket of assets that all sites depend on.
- It makes backup, deletion, and migration happen site by site.

