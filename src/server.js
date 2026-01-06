import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

// Initialize the MCP server
const server = new McpServer({
  name: "SimpleFileManager",
  version: "1.0.0",
});

/**
 * Tool to read a file
 */
server.registerTool(
  "read_file",
  {
    description: "Read the content of a file",
    inputSchema: z.object({
      path: z.string().describe("The path to the file to read"),
    }),
  },
  async ({ path: filePath }) => {
    try {
      const content = await fs.readFile(path.resolve(filePath), "utf-8");
      return {
        content: [{ type: "text", text: content }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error reading file: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool to write a file
 */
server.registerTool(
  "write_file",
  {
    description: "Write content to a file",
    inputSchema: z.object({
      path: z.string().describe("The path where the file should be saved"),
      content: z.string().describe("The content to write to the file"),
    }),
  },
  async ({ path: filePath, content }) => {
    try {
      await fs.writeFile(path.resolve(filePath), content, "utf-8");
      return {
        content: [{ type: "text", text: `Successfully wrote to ${filePath}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error writing file: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Resource to read a file via URI
 */
server.registerResource(
  "file",
  new ResourceTemplate("file:///{path}", { list: undefined }),
  {
    mimeType: "text/plain",
  },
  async (uri, variables) => {
    const filePath = variables.path;
    try {
      const content = await fs.readFile(path.resolve(filePath), "utf-8");
      return {
        contents: [
          {
            uri: uri.href,
            text: content,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Resource error: ${error.message}`);
    }
  }
);

/**
 * Start the server using Stdio transport
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Simple File Manager MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
