import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import util from "util";
import crypto from "crypto";

const WORKSPACE_ROOT = "/workspace";
let workspaceFolderName = null;

const execAsync = util.promisify(exec);
const getWorkspaceDir = () => {
  if (!workspaceFolderName) {
    throw new Error("Workspace not initialized. Run initialize_work first.");
  }
  return path.join(WORKSPACE_ROOT, workspaceFolderName);
};
const getWorkspaceFilePath = (fileName) => {
  const workspaceDir = getWorkspaceDir();
  const resolvedWorkspaceDir = path.resolve(workspaceDir);
  const resolvedPath = path.resolve(workspaceDir, fileName);
  if (!resolvedPath.startsWith(resolvedWorkspaceDir + path.sep)) {
    throw new Error("Invalid file name.");
  }
  return resolvedPath;
};
const runGit = (args) =>
  execAsync(`git ${args.join(" ")}`, { cwd: getWorkspaceDir() });

// Initialize the MCP server
const server = new McpServer({
  name: "SimpleFileManager",
  version: "1.0.0",
});

/**
 * Tool to initialize work
 */
server.registerTool(
  "initialize_work",
  {
    description: "Create and store a new workspace folder under /workspace",
    inputSchema: z.object({}).strict(),
  },
  async () => {
    try {
      const folderName = crypto.randomUUID();
      const folderPath = path.join(WORKSPACE_ROOT, folderName);
      await fs.mkdir(WORKSPACE_ROOT, { recursive: true });
      await fs.mkdir(folderPath);
      const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === folderName) {
          continue;
        }
        const sourcePath = path.join(WORKSPACE_ROOT, entry.name);
        const destinationPath = path.join(folderPath, entry.name);
        await fs.cp(sourcePath, destinationPath, {
          recursive: entry.isDirectory(),
        });
        await fs.rm(sourcePath, { recursive: entry.isDirectory(), force: true });
      }
      workspaceFolderName = folderName;
      return {
        content: [
          {
            type: "text",
            text: `Initialized workspace folder: ${folderName}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Error initializing workspace: ${error.message}` },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool to read a file
 */
server.registerTool(
  "read_file",
  {
    description: "Read the content of a file in the workspace folder",
    inputSchema: z.object({
      name: z.string().min(1).describe("File name inside the workspace folder"),
    }),
  },
  async ({ name }) => {
    try {
      const content = await fs.readFile(getWorkspaceFilePath(name), "utf-8");
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
    description: "Write content to a file in the workspace folder",
    inputSchema: z.object({
      name: z.string().min(1).describe("File name inside the workspace folder"),
      content: z.string().describe("The content to write to the file"),
    }),
  },
  async ({ name, content }) => {
    try {
      await fs.writeFile(getWorkspaceFilePath(name), content, "utf-8");
      return {
        content: [{ type: "text", text: `Successfully wrote to ${name}` }],
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
    description: "Delete a file from the workspace folder",
    inputSchema: z.object({
      name: z.string().min(1).describe("File name inside the workspace folder"),
    }),
  },
  async ({ name }) => {
    try {
      await fs.unlink(getWorkspaceFilePath(name));
      return {
        content: [{ type: "text", text: `Successfully deleted ${name}` }],
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
 * Tool to list files and folders in the workspace folder
 */
server.registerTool(
  "list_dir",
  {
    description: "List files and folders in the workspace folder",
    inputSchema: z.object({}).strict(),
  },
  async () => {
    try {
      const resolvedPath = getWorkspaceDir();
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
    inputSchema: z.object({}).strict(),
  },
  async () => {
    try {
      const { stdout } = await runGit(["status"]);
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

      const { stdout } = await runGit(args);
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
      const args = ["add", ...files];
      await runGit(args);
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
      const { stdout } = await runGit(["commit", "-m", `"${escapedMessage}"`]);
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
      const { stdout } = await runGit(["log", "-n", String(limit)]);
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
 * Tool to set git remote origin URL using env vars
 */
server.registerTool(
  "git_remote_set_url_from_env",
  {
    description:
      "Set git remote origin URL using PROJECT_REPO and GITHUB_TOKEN environment variables",
    inputSchema: z.object({}).strict(),
  },
  async () => {
    const repo = process.env.PROJECT_REPO;
    const token = process.env.GITHUB_TOKEN;
    if (!repo || !token) {
      return {
        content: [
          {
            type: "text",
            text: "Missing PROJECT_REPO or GITHUB_TOKEN environment variable.",
          },
        ],
        isError: true,
      };
    }

    try {
      const repoWithoutScheme = repo
        .replace(/^https?:\/\//, "")
        .replace(/^[^@]+@/, "")
        .replace(/\/+$/, "");
      const url = `https://${token}@${repoWithoutScheme}`;
      const { stdout } = await runGit(["remote", "set-url", "origin", url]);
      return {
        content: [{ type: "text", text: stdout || "Remote URL updated." }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting git remote URL: ${error.message}`,
          },
        ],
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
    }),
  },
  async ({ branch, force }) => {
    try {
      const flag = force ? "-D" : "-d";
      const { stdout } = await runGit(["branch", flag, branch]);
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
 * Tool to create and push a git branch
 */
server.registerTool(
  "git_branch_create_and_push",
  {
    description: "Create and push a git branch",
    inputSchema: z.object({
      branch: z.string().describe("Branch name to create"),
      startPoint: z
        .string()
        .optional()
        .describe("Optional start point (commit, tag, or branch)"),
    }),
  },
  async ({ branch, startPoint }) => {
    try {
      const createArgs = ["checkout", "-b", branch];
      if (startPoint) createArgs.push(startPoint);
      const { stdout: createStdout } = await runGit(createArgs);
      const { stdout: pushStdout } = await runGit([
        "push",
        "-u",
        "origin",
        branch,
      ]);
      return {
        content: [{ type: "text", text: `${createStdout}${pushStdout}` }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating and pushing git branch: ${error.message}`,
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
