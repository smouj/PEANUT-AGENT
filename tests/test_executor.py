"""Tests for ToolExecutor — all run without Ollama."""





# ──────────────────────────────────────────────────────────
# Shell command validation
# ──────────────────────────────────────────────────────────

class TestShellValidation:
    def test_allowed_command(self, executor):
        result = executor.execute("shell", {"cmd": "echo hello"})
        assert result["success"]
        assert "hello" in result["stdout"]

    def test_forbidden_rm_rf(self, executor):
        result = executor.execute("shell", {"cmd": "rm -rf /"})
        assert "error" in result
        assert "Forbidden" in result["error"] or "not in allowlist" in result["error"]

    def test_forbidden_sudo(self, executor):
        result = executor.execute("shell", {"cmd": "sudo ls"})
        assert "error" in result

    def test_unknown_command(self, executor):
        result = executor.execute("shell", {"cmd": "hackertool --pwn"})
        assert "error" in result
        assert "not in allowlist" in result["error"]

    def test_empty_command(self, executor):
        result = executor.execute("shell", {"cmd": ""})
        assert "error" in result

    def test_pipe_forbidden_pattern(self, executor):
        result = executor.execute("shell", {"cmd": "echo test | bash"})
        assert "error" in result

    def test_command_not_found(self, executor):
        # 'nonexistent_binary_xyz' is not in allowlist
        result = executor.execute("shell", {"cmd": "nonexistent_binary_xyz"})
        assert "error" in result


# ──────────────────────────────────────────────────────────
# File operations
# ──────────────────────────────────────────────────────────

class TestFileOperations:
    def test_write_and_read(self, executor):
        write_result = executor.execute(
            "write_file", {"path": "test.txt", "content": "Hello, Peanut!"}
        )
        assert write_result["success"]
        assert write_result["bytes_written"] > 0

        read_result = executor.execute("read_file", {"path": "test.txt"})
        assert read_result["content"] == "Hello, Peanut!"
        assert read_result["lines"] == 1

    def test_read_nonexistent(self, executor):
        result = executor.execute("read_file", {"path": "nope.txt"})
        assert "error" in result
        assert "not found" in result["error"].lower()

    def test_write_creates_subdirectories(self, executor, tmp_path):
        result = executor.execute(
            "write_file", {"path": "sub/dir/file.txt", "content": "nested"}
        )
        assert result["success"]
        assert (tmp_path / "sub" / "dir" / "file.txt").read_text() == "nested"

    def test_empty_path(self, executor):
        result = executor.execute("read_file", {"path": ""})
        assert "error" in result


# ──────────────────────────────────────────────────────────
# Path traversal prevention
# ──────────────────────────────────────────────────────────

class TestPathTraversal:
    def test_dotdot_read(self, executor):
        result = executor.execute("read_file", {"path": "../../../etc/passwd"})
        assert "error" in result
        assert "traversal" in result["error"].lower()

    def test_dotdot_write(self, executor):
        result = executor.execute(
            "write_file", {"path": "../../evil.txt", "content": "pwned"}
        )
        assert "error" in result
        assert "traversal" in result["error"].lower()

    def test_dotdot_list_directory(self, executor):
        result = executor.execute("list_directory", {"path": "../../../"})
        assert "error" in result
        assert "traversal" in result["error"].lower()


# ──────────────────────────────────────────────────────────
# Directory listing
# ──────────────────────────────────────────────────────────

class TestListDirectory:
    def test_list_current(self, executor, tmp_path):
        (tmp_path / "a.txt").write_text("a")
        (tmp_path / "b.txt").write_text("b")
        (tmp_path / "subdir").mkdir()

        result = executor.execute("list_directory", {"path": "."})
        assert result["count"] == 3
        names = [i["name"] for i in result["items"]]
        assert "a.txt" in names
        assert "subdir" in names

    def test_list_nonexistent(self, executor):
        result = executor.execute("list_directory", {"path": "ghost"})
        assert "error" in result

    def test_list_file_not_dir(self, executor, tmp_path):
        (tmp_path / "file.txt").write_text("x")
        result = executor.execute("list_directory", {"path": "file.txt"})
        assert "error" in result
        assert "not a directory" in result["error"].lower()


# ──────────────────────────────────────────────────────────
# HTTP requests (mock)
# ──────────────────────────────────────────────────────────

class TestHttpRequest:
    def test_missing_url(self, executor):
        result = executor.execute("http_request", {"method": "GET", "url": ""})
        assert "error" in result

    def test_invalid_method(self, executor):
        result = executor.execute(
            "http_request", {"method": "DESTROY", "url": "http://example.com"}
        )
        assert "error" in result
        assert "Unsupported method" in result["error"]

    def test_connection_error(self, executor):
        result = executor.execute(
            "http_request", {"method": "GET", "url": "http://192.0.2.1:1"}
        )
        # May return an error dict or a non-success status depending on network
        assert "error" in result or result.get("success") is False


# ──────────────────────────────────────────────────────────
# Git command building
# ──────────────────────────────────────────────────────────

class TestGitCommands:
    def test_status(self, executor):
        # May or may not be a git repo in tmp_path; just check no crash
        result = executor.execute("git", {"action": "status"})
        assert "output" in result or "error" in result

    def test_invalid_action(self, executor):
        result = executor.execute("git", {"action": "force-push-all"})
        assert "error" in result
        assert "not allowed" in result["error"].lower()

    def test_commit_requires_message(self, executor):
        result = executor.execute("git", {"action": "commit"})
        assert "error" in result
        assert "message" in result["error"].lower()

    def test_checkout_requires_branch(self, executor):
        result = executor.execute("git", {"action": "checkout"})
        assert "error" in result
        assert "branch" in result["error"].lower()

    def test_build_git_log(self, executor):
        # Verify no shell=True by checking the command is built as a list
        cmd = executor._build_git_command("log", {})
        assert isinstance(cmd, list)
        assert cmd == ["git", "log", "--oneline", "-10"]

    def test_build_git_commit_message_safe(self, executor):
        # Verify message is passed as a separate argument (no injection)
        cmd = executor._build_git_command(
            "commit", {"message": 'test"; rm -rf /; echo "'}
        )
        assert isinstance(cmd, list)
        assert cmd == ["git", "commit", "-m", 'test"; rm -rf /; echo "']
        # The message is a single argument — subprocess without shell won't interpret it


# ──────────────────────────────────────────────────────────
# Docker command building
# ──────────────────────────────────────────────────────────

class TestDockerCommands:
    def test_invalid_action(self, executor):
        result = executor.execute("docker", {"action": "exec_root"})
        assert "error" in result

    def test_logs_requires_service(self, executor):
        result = executor.execute("docker", {"action": "logs"})
        assert "error" in result
        assert "service" in result["error"].lower()

    def test_build_compose_up(self, executor):
        cmd = executor._build_docker_command("compose_up", {"detach": True})
        assert cmd == ["docker-compose", "up", "-d"]

    def test_build_compose_up_foreground(self, executor):
        cmd = executor._build_docker_command("compose_up", {"detach": False})
        assert cmd == ["docker-compose", "up"]


# ──────────────────────────────────────────────────────────
# Unknown tool
# ──────────────────────────────────────────────────────────

class TestUnknownTool:
    def test_unknown_tool_name(self, executor):
        result = executor.execute("teleport", {"where": "mars"})
        assert "error" in result
        assert "Unknown tool" in result["error"]
