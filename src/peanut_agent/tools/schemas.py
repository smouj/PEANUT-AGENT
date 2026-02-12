"""
JSON Schema definitions for Ollama tool calling.

These schemas tell the LLM what tools are available and
how to call them. They follow the OpenAI function-calling
format that Ollama supports.
"""

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "shell",
            "description": (
                "Execute a safe shell command. Only allowlisted commands are "
                "permitted (ls, cat, grep, find, python, npm, git, docker, curl, etc). "
                "Destructive commands (rm, sudo, kill, shutdown) are blocked."
            ),
            "parameters": {
                "type": "object",
                "required": ["cmd"],
                "properties": {
                    "cmd": {
                        "type": "string",
                        "description": (
                            "The command to execute (e.g. 'ls -la', 'python3 script.py')"
                        ),
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a text file. Path must be relative to workspace.",
            "parameters": {
                "type": "object",
                "required": ["path"],
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to the file (e.g. 'src/main.py')",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": (
                "Write content to a file (creates or overwrites). "
                "Path must be relative to workspace."
            ),
            "parameters": {
                "type": "object",
                "required": ["path", "content"],
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to the file (e.g. 'output.txt')",
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write to the file",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_directory",
            "description": "List files and directories at a given path within the workspace.",
            "parameters": {
                "type": "object",
                "required": ["path"],
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative directory path (use '.' for current workspace)",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "http_request",
            "description": "Make an HTTP request to a URL.",
            "parameters": {
                "type": "object",
                "required": ["method", "url"],
                "properties": {
                    "method": {
                        "type": "string",
                        "enum": ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"],
                        "description": "HTTP method",
                    },
                    "url": {
                        "type": "string",
                        "description": "Full URL (e.g. 'https://api.example.com/data')",
                    },
                    "headers": {
                        "type": "object",
                        "description": "Optional HTTP headers",
                    },
                    "body": {
                        "description": "Request body (JSON object or string)",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git",
            "description": (
                "Execute git operations: status, log, diff, branch, add, commit, "
                "push, pull, checkout, stash, fetch, remote, tag."
            ),
            "parameters": {
                "type": "object",
                "required": ["action"],
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": [
                            "status", "log", "diff", "branch", "add",
                            "commit", "push", "pull", "checkout", "stash",
                            "fetch", "remote", "tag",
                        ],
                        "description": "Git operation to perform",
                    },
                    "message": {
                        "type": "string",
                        "description": "Commit message (required for action='commit')",
                    },
                    "branch": {
                        "type": "string",
                        "description": "Branch name (for push, pull, checkout, fetch)",
                    },
                    "files": {
                        "type": "string",
                        "description": "Files to add (for action='add', default='.')",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "docker",
            "description": (
                "Execute docker and docker-compose operations: ps, logs, images, "
                "compose_up, compose_down, compose_ps, compose_logs."
            ),
            "parameters": {
                "type": "object",
                "required": ["action"],
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": [
                            "ps", "logs", "images",
                            "compose_up", "compose_down", "compose_ps", "compose_logs",
                        ],
                        "description": "Docker operation to perform",
                    },
                    "service": {
                        "type": "string",
                        "description": "Service or container name (for logs)",
                    },
                    "detach": {
                        "type": "boolean",
                        "description": "Run in background (for compose_up, default=true)",
                    },
                },
            },
        },
    },
]
