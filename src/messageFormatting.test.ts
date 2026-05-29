import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseRichTextBlocks } from './messageFormatting.js';

describe('parseRichTextBlocks', () => {
  it('parses common markdown-style blocks', () => {
    const blocks = parseRichTextBlocks(`# 结论

这是第一段，带有 **强调** 和 \`inline code\`.

- 第一项
- 第二项

> 一句引用

\`\`\`ts
const value = 42;
\`\`\`
`);

    assert.deepEqual(blocks.map((block) => block.kind), ['heading', 'paragraph', 'list', 'quote', 'code']);

    const [heading, paragraph, list, quote, code] = blocks;
    assert.equal(heading.kind, 'heading');
    if (heading.kind === 'heading') {
      assert.equal(heading.level, 1);
      assert.equal(heading.content, '结论');
    }

    assert.equal(paragraph.kind, 'paragraph');
    if (paragraph.kind === 'paragraph') {
      assert.match(paragraph.content, /强调/);
      assert.match(paragraph.content, /inline code/);
    }

    assert.equal(list.kind, 'list');
    if (list.kind === 'list') {
      assert.equal(list.ordered, false);
      assert.deepEqual(list.items, ['第一项', '第二项']);
    }

    assert.equal(quote.kind, 'quote');
    if (quote.kind === 'quote') {
      assert.equal(quote.content, '一句引用');
    }

    assert.equal(code.kind, 'code');
    if (code.kind === 'code') {
      assert.equal(code.language, 'ts');
      assert.match(code.content, /const value = 42;/);
    }
  });
});
