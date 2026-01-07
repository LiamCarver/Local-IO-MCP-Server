import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

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
 * Tool to get git status
 */
server.registerTool(
  "git_status",
  {
    description: "Get the status of the git repository",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const { stdout } = await execAsync("git status");
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error running git status: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool to get git diff
 */
server.registerTool(
  "git_diff",
  {
    description: "Get git diff",
    inputSchema: z.object({
      staged: z.boolean().optional().describe("Whether to show staged changes"),
      file: z.string().optional().describe("Specific file to diff"),
    }),
  },
  async ({ staged, file }) => {
    try {
      const args = ["diff"];
      if (staged) args.push("--staged");
      if (file) args.push(file);
      
      const { stdout } = await execAsync(`git ${args.join(" ")}`);
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error running git diff: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool to add files to git
 */
server.registerTool(
  "git_add",
  {
    description: "Add files to git stage",
    inputSchema: z.object({
      files: z.array(z.string()).describe("List of files to add"),
    }),
  },
  async ({ files }) => {
    try {
      const fileList = files.join(" ");
      await execAsync(`git add ${fileList}`);
      return {
        content: [{ type: "text", text: `Successfully added: ${files.join(", ")}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error running git add: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool to commit changes
 */
server.registerTool(
  "git_commit",
  {
    description: "Commit changes to git",
    inputSchema: z.object({
      message: z.string().describe("Commit message"),
    }),
  },
  async ({ message }) => {
    try {
      // Escape quotes in message to prevent shell issues
      const escapedMessage = message.replace(/"/g, '\\"');
      const { stdout } = await execAsync(`git commit -m "${escapedMessage}"`);
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error running git commit: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool to show git log
 */
server.registerTool(
  "git_log",
  {
    description: "Show git commit log",
    inputSchema: z.object({
      limit: z.number().optional().default(10).describe("Number of commits to show"),
    }),
  },
  async ({ limit }) => {
    try {
      const { stdout } = await execAsync(`git log -n ${limit}`);
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error running git log: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool to list git worktrees
 */
server.registerTool(
  "git_worktree_list",
  {
    description: "List git worktrees",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const { stdout } = await execAsync("git worktree list");
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error listing worktrees: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool to add a git worktree
 */
server.registerTool(
  "git_worktree_add",
  {
    description: "Add a new git worktree",
    inputSchema: z.object({
      path: z.string().describe("Path to the new worktree"),
      branch: z.string().describe("Branch to checkout"),
    }),
  },
  async ({ path: worktreePath, branch }) => {
    try {
      const { stdout } = await execAsync(`git worktree add ${worktreePath} ${branch}`);
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error adding worktree: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool to remove a git worktree
 */
server.registerTool(
  "git_worktree_remove",
  {
    description: "Remove a git worktree",
    inputSchema: z.object({
      path: z.string().describe("Path of the worktree to remove"),
    }),
  },
  async ({ path: worktreePath }) => {
    try {
      const { stdout } = await execAsync(`git worktree remove ${worktreePath}`);
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error removing worktree: ${error.message}` }],
        isError: true,
      };
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
