import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let client = null;

export async function getBreethClient() {
  if (client) return client;
  try {
    const transport = new StdioClientTransport({
      command: "npx",
      args: [
        "-y",
        "mcp-remote",
        "https://mcp.thebreeth.com/mcp",
        "--header",
        "Authorization: Bearer ck_live_HCnnymcKdTF0_Eyl26H9ZyH5yNeusJljXIzjxRxU5ZQ"
      ]
    });
    client = new Client(
      { name: "autonomous-agent", version: "1.0.0" },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {}
        }
      }
    );
    await client.connect(transport);
    console.log("Successfully connected to Breeth MCP server!");
    return client;
  } catch (error) {
    console.error("Failed to connect to Breeth MCP:", error);
    return null;
  }
}

export async function checkMemoryForTopic(topic) {
  const mcpClient = await getBreethClient();
  if (!mcpClient) {
    console.log("Memory check fallback: Breeth client not available.");
    return false;
  }

  try {
    const response = await mcpClient.callTool({
      name: "search_graph",
      arguments: {
        query: `published post about ${topic}`,
        limit: 3
      }
    });

    if (response && response.content) {
      const textContent = response.content.map(c => c.text || '').join(' ').toLowerCase();
      // If the response text contains references to having already published, return true
      if (textContent.includes("published_post") || textContent.includes("published") || textContent.includes(topic.toLowerCase())) {
        console.log(`Memory hit: Topic "${topic}" already found in Breeth memory.`);
        return true;
      }
    }
  } catch (error) {
    console.error("Error checking Breeth memory:", error);
  }
  return false;
}

export async function recordPostInMemory(agentName, postId, topic, text) {
  const mcpClient = await getBreethClient();
  if (!mcpClient) {
    console.log("Memory record fallback: Breeth client not available.");
    return;
  }

  try {
    // 1. Record structured fact: subject predicate object
    await mcpClient.callTool({
      name: "record_fact",
      arguments: {
        subject: agentName,
        predicate: "published",
        object: `${postId}: ${topic}`
      }
    });

    // 2. Add rich episodic memory
    await mcpClient.callTool({
      name: "add_episode",
      arguments: {
        content: `Agent ${agentName} published a post (ID: ${postId}) on the topic "${topic}". Content: "${text}"`,
        source_description: "autonomous-agent-feed"
      }
    });

    console.log(`Successfully recorded post "${postId}" in Breeth memory graph.`);
  } catch (error) {
    console.error("Error recording post to Breeth memory:", error);
  }
}
