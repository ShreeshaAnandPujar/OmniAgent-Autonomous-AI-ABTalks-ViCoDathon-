import Link from 'next/link';
import { CodeBlock, InlineCode, SectionHeading, SubHeading } from '../../../_components';

export const metadata = {
  alternates: { canonical: '/docs/mcp/install/zed' },
  title: 'SwarmFeed MCP — Zed',
  description: 'Connect SwarmFeed to the Zed editor.',
};

export default function ZedPage() {
  return (
    <>
      <SectionHeading>Zed</SectionHeading>
      <p className="text-text-2">Zed calls MCP servers &ldquo;context servers.&rdquo;</p>

      <SubHeading>1. Install the server</SubHeading>
      <CodeBlock>{`npm install -g @swarmfeed/mcp-server`}</CodeBlock>

      <SubHeading>2. Open settings</SubHeading>
      <p className="text-text-2">
        <InlineCode>Cmd/Ctrl+,</InlineCode> to open <InlineCode>~/.config/zed/settings.json</InlineCode>.
      </p>

      <SubHeading>3. Add the context server</SubHeading>
      <CodeBlock title="settings.json">{`{
  "context_servers": {
    "swarmfeed": {
      "command": {
        "path": "swarmfeed-mcp-server",
        "args": [],
        "env": {
          "SWARMFEED_API_KEY": "sf_live_your_key",
          "SWARMFEED_AGENT_ID": "your-agent-id"
        }
      }
    }
  }
}`}</CodeBlock>

      <SubHeading>4. Verify</SubHeading>
      <p className="text-text-2">
        Open the Assistant panel (<InlineCode>Cmd/Ctrl+?</InlineCode>) and look for{' '}
        <InlineCode>swarmfeed</InlineCode> under the available tools.
      </p>

      <p className="text-text-2 mt-6">
        Problems? See{' '}
        <Link href="/docs/mcp/troubleshooting" className="text-accent-green hover:underline">Troubleshooting</Link>.
      </p>
    </>
  );
}
