import type { ReactNode } from 'react';

export type RichTextBlock =
  | { kind: 'paragraph'; content: string }
  | { kind: 'heading'; level: 1 | 2 | 3; content: string }
  | { kind: 'quote'; content: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; language: string | null; content: string };

type InlineSegment =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; label: string; href: string };

const HEADING_TAGS = ['h3', 'h4', 'h5'] as const;

function flushParagraph(blocks: RichTextBlock[], paragraphLines: string[]): void {
  if (paragraphLines.length === 0) {
    return;
  }

  const content = paragraphLines.join('\n').trim();
  if (content) {
    blocks.push({ kind: 'paragraph', content });
  }
  paragraphLines.length = 0;
}

function pushListLine(items: string[], value: string): void {
  const content = value.trim();
  if (content) {
    items.push(content);
  }
}

export function parseRichTextBlocks(rawContent: string): RichTextBlock[] {
  const content = rawContent.replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  const blocks: RichTextBlock[] = [];
  const paragraphLines: string[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(blocks, paragraphLines);
      index += 1;
      continue;
    }

    const fenceMatch = trimmed.match(/^```([\w-]+)?\s*$/);
    if (fenceMatch) {
      flushParagraph(blocks, paragraphLines);
      const language = fenceMatch[1] ?? null;
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length && lines[index].trim().startsWith('```')) {
        index += 1;
      }

      blocks.push({ kind: 'code', language, content: codeLines.join('\n').replace(/\s+$/g, '') });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(blocks, paragraphLines);
      blocks.push({
        kind: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        content: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph(blocks, paragraphLines);
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const quoteLine = lines[index].trim();
        if (!quoteLine.startsWith('>')) {
          break;
        }
        quoteLines.push(quoteLine.replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ kind: 'quote', content: quoteLines.join('\n').trim() });
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph(blocks, paragraphLines);
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];

      while (index < lines.length) {
        const listLine = lines[index].trim();
        const currentMatch = ordered
          ? listLine.match(/^\d+\.\s+(.+)$/)
          : listLine.match(/^[-*•]\s+(.+)$/);
        if (!currentMatch) {
          break;
        }
        pushListLine(items, currentMatch[1]);
        index += 1;
      }

      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    paragraphLines.push(line);
    index += 1;
  }

  flushParagraph(blocks, paragraphLines);
  return blocks;
}

function parseInlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];

  for (let cursor = 0; cursor < text.length; ) {
    if (text.startsWith('**', cursor)) {
      const closing = text.indexOf('**', cursor + 2);
      if (closing > cursor + 2) {
        segments.push({ kind: 'strong', value: text.slice(cursor + 2, closing) });
        cursor = closing + 2;
        continue;
      }
    }

    if (text[cursor] === '`') {
      const closing = text.indexOf('`', cursor + 1);
      if (closing > cursor + 1) {
        segments.push({ kind: 'code', value: text.slice(cursor + 1, closing) });
        cursor = closing + 1;
        continue;
      }
    }

    if (text[cursor] === '[') {
      const closingLabel = text.indexOf(']', cursor + 1);
      const openingHref = closingLabel > -1 ? text[closingLabel + 1] : null;
      const closingHref = closingLabel > -1 && openingHref === '(' ? text.indexOf(')', closingLabel + 2) : -1;
      if (closingLabel > cursor + 1 && closingHref > closingLabel + 2) {
        segments.push({
          kind: 'link',
          label: text.slice(cursor + 1, closingLabel),
          href: text.slice(closingLabel + 2, closingHref),
        });
        cursor = closingHref + 1;
        continue;
      }
    }

    let nextToken = text.length;
    for (const token of ['**', '`', '[']) {
      const nextIndex = text.indexOf(token, cursor + 1);
      if (nextIndex !== -1 && nextIndex < nextToken) {
        nextToken = nextIndex;
      }
    }

    segments.push({ kind: 'text', value: text.slice(cursor, nextToken) });
    cursor = nextToken;
  }

  return segments;
}

function renderInlineSegments(text: string, keyPrefix: string): ReactNode[] {
  const segments = parseInlineSegments(text);
  const nodes: ReactNode[] = [];

  segments.forEach((segment, index) => {
    if (segment.kind === 'text') {
      const parts = segment.value.split('\n');
      parts.forEach((part, partIndex) => {
        if (partIndex > 0) {
          nodes.push(<br key={`${keyPrefix}-${index}-br-${partIndex}`} />);
        }
        if (part) {
          nodes.push(part);
        }
      });
      return;
    }

    if (segment.kind === 'strong') {
      nodes.push(<strong key={`${keyPrefix}-${index}`}>{segment.value}</strong>);
      return;
    }

    if (segment.kind === 'code') {
      nodes.push(
        <code key={`${keyPrefix}-${index}`} className="sn-chat-inline-code">
          {segment.value}
        </code>,
      );
      return;
    }

    nodes.push(
      <a
        key={`${keyPrefix}-${index}`}
        className="sn-chat-link"
        href={segment.href}
        target="_blank"
        rel="noreferrer"
      >
        {segment.label}
      </a>,
    );
  });

  return nodes;
}

export function RichTextMessage({ content }: { content: string }): ReactNode {
  const blocks = parseRichTextBlocks(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="sn-chat-markdown">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          const HeadingTag = HEADING_TAGS[block.level - 1];
          return (
            <HeadingTag key={`${block.kind}-${index}`} className={`sn-chat-heading is-level-${block.level}`}>
              {renderInlineSegments(block.content, `${block.kind}-${index}`)}
            </HeadingTag>
          );
        }

        if (block.kind === 'quote') {
          return (
            <blockquote key={`${block.kind}-${index}`} className="sn-chat-quote">
              <div className="sn-chat-quote-mark" aria-hidden="true">
                "
              </div>
              <div className="sn-chat-quote-body">{renderInlineSegments(block.content, `${block.kind}-${index}`)}</div>
            </blockquote>
          );
        }

        if (block.kind === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag key={`${block.kind}-${index}`} className={`sn-chat-list ${block.ordered ? 'is-ordered' : 'is-unordered'}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${block.kind}-${index}-item-${itemIndex}`}>{renderInlineSegments(item, `${block.kind}-${index}-item-${itemIndex}`)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.kind === 'code') {
          return (
            <div key={`${block.kind}-${index}`} className="sn-chat-code-block">
              {block.language ? <div className="sn-chat-code-lang">{block.language}</div> : null}
              <pre className="sn-chat-code-pre">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        return (
          <p key={`${block.kind}-${index}`} className="sn-chat-paragraph">
            {renderInlineSegments(block.content, `${block.kind}-${index}`)}
          </p>
        );
      })}
    </div>
  );
}
