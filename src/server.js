import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);
const repoPathSchema = z
  .string()
  .optional()
  .describe("Path to the git repository (defaults to current working directory)");
const resolveRepoPath = (repoPath) =>
  repoPath ? path.resolve(repoPath) : process.cwd();
const runGit = (args, repoPath) =>
  execAsync(`git ${args.join(" ")}`, { cwd: resolveRepoPath(repoPath) });

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
 * Tool to delete a file
 */
server.registerTool(
  "delete_file",
  {
    description: "Delete a file",
    inputSchema: z.object({
      path: z.string().describe("The path to the file to delete"),
    }),
  },
  async ({ path: filePath }) => {
    try {
      await fs.unlink(path.resolve(filePath));
      return {
        content: [{ type: "text", text: `Successfully deleted ${filePath}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error deleting file: ${error.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool to list files and folders in a path
 */
server.registerTool(
  "list_dir",
  {
    description: "List files and folders from a path",
    inputSchema: z.object({
      path: z.string().describe("The directory path to list"),
    }),
  },
  async ({ path: dirPath }) => {
    try {
      const resolvedPath = path.resolve(dirPath);
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      const listing = entries
        .map((entry) => {
          const type = entry.isDirectory() ? "dir" : "file";
          return `${type}\t${entry.name}`;
        })
        .join("\n");
      return {
        content: [{ type: "text", text: listing }],
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Error listing directory: ${error.message}` },
        ],
        isError: true,
      };
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
    inputSchema: z.object({
      repoPath: repoPathSchema,
    }),
  },
  async ({ repoPath }) => {
    try {
      const { stdout } = await runGit(["status"], repoPath);
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
      repoPath: repoPathSchema,
    }),
  },
  async ({ staged, file, repoPath }) => {
    try {
      const args = ["diff"];
      if (staged) args.push("--staged");
      if (file) args.push(file);

      const { stdout } = await runGit(args, repoPath);
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
      repoPath: repoPathSchema,
    }),
  },
  async ({ files, repoPath }) => {
    try {
      const args = ["add", ...files];
      await runGit(args, repoPath);
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
      repoPath: repoPathSchema,
    }),
  },
  async ({ message, repoPath }) => {
    try {
      // Escape quotes in message to prevent shell issues
      const escapedMessage = message.replace(/"/g, '\\"');
      const { stdout } = await runGit(
        ["commit", "-m", `"${escapedMessage}"`],
        repoPath
      );
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
      repoPath: repoPathSchema,
    }),
  },
  async ({ limit, repoPath }) => {
    try {
      const { stdout } = await runGit(["log", "-n", String(limit)], repoPath);
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
 * Tool to delete a git branch
 */
server.registerTool(
  "git_branch_delete",
  {
    description: "Delete a git branch",
    inputSchema: z.object({
      branch: z.string().describe("Branch to delete"),
      force: z
        .boolean()
        .optional()
        .describe("Force deletion of the branch"),
      repoPath: repoPathSchema,
    }),
  },
  async ({ branch, force, repoPath }) => {
    try {
      const flag = force ? "-D" : "-d";
      const { stdout } = await runGit(["branch", flag, branch], repoPath);
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting git branch: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool to create a git branch
 */
server.registerTool(
  "git_branch_create",
  {
    description: "Create a git branch",
    inputSchema: z.object({
      branch: z.string().describe("Branch name to create"),
      startPoint: z
        .string()
        .optional()
        .describe("Optional start point (commit, tag, or branch)"),
      repoPath: repoPathSchema,
    }),
  },
  async ({ branch, startPoint, repoPath }) => {
    try {
      const args = ["branch", branch];
      if (startPoint) args.push(startPoint);
      const { stdout } = await runGit(args, repoPath);
      return {
        content: [{ type: "text", text: stdout }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating git branch: ${error.message}`,
          },
        ],
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
