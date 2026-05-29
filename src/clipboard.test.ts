import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { copyText } from './clipboard';

describe('copyText', () => {
  it('uses the Clipboard API when available', async () => {
    const calls: string[] = [];
    const result = await copyText('https://example.com', {
      navigator: {
        clipboard: {
          writeText: async (value: string) => {
            calls.push(value);
          },
        } as unknown as Clipboard,
      },
    });

    assert.equal(result, true);
    assert.deepEqual(calls, ['https://example.com']);
  });

  it('uses execCommand before falling back to the Clipboard API', async () => {
    const calls: string[] = [];
    const appended: HTMLElement[] = [];
    const removed: HTMLElement[] = [];
    const selected: string[] = [];
    const focused: string[] = [];

    const textarea = {
      value: '',
      readOnly: false,
      style: {},
      focus: () => {
        focused.push(textarea.value);
      },
      select: () => {
        selected.push(textarea.value);
      },
      setSelectionRange: () => undefined,
      setAttribute: () => undefined,
    } as unknown as HTMLTextAreaElement;

    const result = await copyText('https://example.com', {
      navigator: {
        clipboard: {
          writeText: async () => {
            calls.push('clipboard');
          },
        } as unknown as Clipboard,
      },
      document: {
        body: {
          appendChild: (node: HTMLElement) => {
            appended.push(node);
            return node;
          },
          removeChild: (node: HTMLElement) => {
            removed.push(node);
            return node;
          },
        } as unknown as HTMLBodyElement,
        createElement: (tagName: string) => {
          assert.equal(tagName, 'textarea');
          return textarea;
        },
        execCommand: (command: string) => {
          calls.push(command);
          return command === 'copy';
        },
      } as unknown as Document,
    });

    assert.equal(result, true);
    assert.equal(appended.length, 1);
    assert.equal(removed.length, 1);
    assert.deepEqual(focused, ['https://example.com']);
    assert.deepEqual(selected, ['https://example.com']);
    assert.deepEqual(calls, ['copy']);
  });

  it('falls back to the Clipboard API when execCommand fails', async () => {
    const calls: string[] = [];

    const result = await copyText('https://example.com', {
      navigator: {
        clipboard: {
          writeText: async (value: string) => {
            calls.push(value);
          },
        } as unknown as Clipboard,
      },
      document: {
        body: {
          appendChild: () => undefined,
          removeChild: () => undefined,
        } as unknown as HTMLBodyElement,
        createElement: (tagName: string) => {
          assert.equal(tagName, 'textarea');
          return {
            value: '',
            style: {},
            setAttribute: () => undefined,
            focus: () => undefined,
            select: () => undefined,
            setSelectionRange: () => undefined,
          } as unknown as HTMLTextAreaElement;
        },
        execCommand: () => false,
      } as unknown as Document,
    });

    assert.equal(result, true);
    assert.deepEqual(calls, ['https://example.com']);
  });
});
