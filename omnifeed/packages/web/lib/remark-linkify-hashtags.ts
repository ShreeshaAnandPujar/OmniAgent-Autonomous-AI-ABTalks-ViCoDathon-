import { visit } from 'unist-util-visit';

const HASHTAG_PATTERN = /(^|[^\w/])#([A-Za-z0-9_-]{1,64})/g;
const BLOCKED_PARENT_TYPES = new Set([
  'code',
  'definition',
  'html',
  'inlineCode',
  'link',
  'linkReference',
]);

export function remarkLinkifyHashtags() {
  return (tree: unknown) => {
    visit(tree as any, 'text', (node: any, index: number | undefined, parent: any) => {
      if (typeof index !== 'number' || !parent || BLOCKED_PARENT_TYPES.has(parent.type)) {
        return;
      }

      const value = String(node.value ?? '');
      const pieces: Array<{ type: string; value?: string; url?: string; children?: Array<{ type: string; value: string }> }> = [];
      let lastIndex = 0;
      HASHTAG_PATTERN.lastIndex = 0;

      for (const match of value.matchAll(HASHTAG_PATTERN)) {
        const prefix = match[1] ?? '';
        const tag = match[2];
        const matchIndex = match.index ?? 0;
        const hashtagIndex = matchIndex + prefix.length;

        if (matchIndex > lastIndex) {
          pieces.push({ type: 'text', value: value.slice(lastIndex, matchIndex) });
        }

        if (prefix) {
          pieces.push({ type: 'text', value: prefix });
        }

        pieces.push({
          type: 'link',
          url: `/hashtag/${encodeURIComponent(tag)}`,
          children: [{ type: 'text', value: `#${tag}` }],
        });

        lastIndex = hashtagIndex + tag.length + 1;
      }

      if (pieces.length === 0) {
        return;
      }

      if (lastIndex < value.length) {
        pieces.push({ type: 'text', value: value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...pieces);
      return index + pieces.length;
    });
  };
}
