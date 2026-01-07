# Plan for Exposing Git Functionality

This document outlines the plan to extend the `SimpleFileManager` MCP server with Git capabilities.

## Goal
To allow LLMs or other clients to interact with the Git repository in the current working directory via the MCP server.

## Proposed Tools

### 1. `git_status`
- **Description:** Returns the status of the working tree.
- **Input:** None (or optional `path`).
- **Output:** Text description of modified, added, and deleted files.
- **Implementation:** Wraps `git status --porcelain` or similar for machine-readable output, or standard `git status` for human-readable output.

### 2. `git_diff`
- **Description:** Shows changes between commits, commit and working tree, etc.
- **Input:** 
    - `staged` (boolean): If true, show staged changes (`--staged`).
    - `file` (string, optional): Limit diff to specific file.
- **Output:** Diff content.

### 3. `git_add`
- **Description:** Adds file contents to the index.
- **Input:**
    - `files` (array of strings): List of files to add.
- **Output:** Success message or error.

### 4. `git_commit`
- **Description:** Records changes to the repository.
- **Input:**
    - `message` (string): The commit message.
- **Output:** Success message with commit hash.

### 5. `git_log`
- **Description:** Shows commit logs.
- **Input:**
    - `limit` (number, optional): Max number of commits to show.
- **Output:** List of commits.

### 6. `git_worktree_list`
- **Description:** List details of each working tree.
- **Input:** None.
- **Output:** List of worktrees (path, HEAD, branch).

### 7. `git_worktree_add`
- **Description:** Create a new working tree.
- **Input:**
    - `path` (string): Path to the new working tree.
    - `branch` (string): Branch name to check out (will be created if it doesn't exist, or checked out if it does).
- **Output:** Success message.

### 8. `git_worktree_remove`
- **Description:** Remove a working tree.
- **Input:**
    - `path` (string): Path of the working tree to remove.
- **Output:** Success message.

## Implementation Details
- We will use `child_process.exec` or `spawn` to run git commands.
- We need to handle errors gracefully (e.g., not a git repo).
- Input validation using Zod schemas.
