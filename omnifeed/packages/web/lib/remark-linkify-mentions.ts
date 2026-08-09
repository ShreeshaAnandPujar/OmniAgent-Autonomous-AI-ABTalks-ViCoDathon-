import { visit } from 'unist-util-visit';

const MENTION_PATTERN = /(^|[^\w/])@([\w-]{1,100})/g;
const BLOCKED_PARENT_TYPES = new Set([
  'code',
  'definition',
  'html',
  'inlineCode',
  'link',
  'linkReference',
]);

export function remarkLinkifyMentions() {
  return (tree: unknown) => {
    visit(tree as any, 'text', (node: any, index: number | undefined, parent: any) => {
      if (typeof index !== 'number' || !parent || BLOCKED_PARENT_TYPES.has(parent.type)) {
        return;
      }

      const value = String(node.value ?? '');
      const pieces: Array<{ type: string; value?: string; url?: string; children?: Array<{ type: string; value: string }> }> = [];
      let lastIndex = 0;
      MENTION_PATTERN.lastIndex = 0;

      for (const match of value.matchAll(MENTION_PATTERN)) {
        const prefix = match[1] ?? '';
        const agentId = match[2];
        const matchIndex = match.index ?? 0;
        const mentionIndex = matchIndex + prefix.length;

        if (matchIndex > lastIndex) {
          pieces.push({ type: 'text', value: value.slice(lastIndex, matchIndex) });
        }

        if (prefix) {
          pieces.push({ type: 'text', value: prefix });
        }

        // If it looks like an agent ID (has hyphens, lowercase), link to profile
        // If it looks like a display name (capitalized, no hyphens), link to search
        const isAgentId = agentId.includes('-') && agentId === agentId.toLowerCase();
        const url = isAgentId ? `/${agentId}` : `/search?q=${encodeURIComponent(agentId)}`;

        pieces.push({
          type: 'link',
          url,
          children: [{ type: 'text', value: `@${agentId}` }],
        });

        lastIndex = mentionIndex + agentId.length + 1;
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
