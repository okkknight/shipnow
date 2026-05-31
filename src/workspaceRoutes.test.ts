import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildProjectLivePath,
  buildProjectPreviewPath,
  hasEverBuiltPreviewProject,
  hasEverPublishedProject,
  parseWorkspaceRoute,
} from './workspaceRoutes';

describe('workspace routes', () => {
  it('parses preview and live project routes', () => {
    assert.deepEqual(parseWorkspaceRoute('/shipnow/project/proj_8fbb78c807eb/preview', '/shipnow'), {
      kind: 'project-preview',
      projectId: 'proj_8fbb78c807eb',
    });

    assert.deepEqual(parseWorkspaceRoute('/shipnow/project/proj_8fbb78c807eb/live', '/shipnow'), {
      kind: 'project-live',
      projectId: 'proj_8fbb78c807eb',
    });
  });

  it('builds preview and live project paths', () => {
    assert.equal(buildProjectPreviewPath('proj_8fbb78c807eb'), '/project/proj_8fbb78c807eb/preview');
    assert.equal(buildProjectLivePath('proj_8fbb78c807eb'), '/project/proj_8fbb78c807eb/live');
  });
});

describe('project publication state', () => {
  it('detects whether a project has ever built a preview', () => {
    assert.equal(hasEverBuiltPreviewProject({ previewReleasePath: null }), false);
    assert.equal(hasEverBuiltPreviewProject({ previewReleasePath: '/tmp/release-preview' }), true);
  });

  it('detects whether a project has ever been published', () => {
    assert.equal(
      hasEverPublishedProject({ lastPublishedAt: null, publicReleasePath: null, status: 'preview_ready' }),
      false
    );
    assert.equal(
      hasEverPublishedProject({ lastPublishedAt: '2026-05-29T10:00:00.000Z', publicReleasePath: null, status: 'preview_ready' }),
      true
    );
  });
});
