"""
CLI interface for Peanut Agent using Rich.

Provides an interactive chat mode and a single-command mode
with a professional terminal interface.
"""

import argparse
import logging
import sys

from peanut_agent import __version__
from peanut_agent.agent import PeanutAgent
from peanut_agent.config import AgentConfig

try:
    from rich.console import Console
    from rich.logging import RichHandler
    from rich.panel import Panel
    from rich.table import Table
    from rich.text import Text

    HAS_RICH = True
except ImportError:
    HAS_RICH = False


def setup_logging(level: str = "INFO") -> None:
    """Configure logging with Rich handler if available."""
    if HAS_RICH:
        logging.basicConfig(
            level=getattr(logging, level.upper(), logging.INFO),
            format="%(message)s",
            datefmt="[%X]",
            handlers=[RichHandler(rich_tracebacks=True, show_path=False)],
        )
    else:
        logging.basicConfig(
            level=getattr(logging, level.upper(), logging.INFO),
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="peanut",
        description="Peanut Agent - Local AI agent with tool calling",
    )
    parser.add_argument(
        "-V", "--version", action="version", version=f"peanut-agent {__version__}"
    )
    parser.add_argument(
        "-m", "--model", default=None,
        help="Ollama model to use (default: qwen2.5:7b)",
    )
    parser.add_argument(
        "-t", "--temperature", type=float, default=None,
        help="Sampling temperature (default: 0.0)",
    )
    parser.add_argument(
        "-w", "--work-dir", default=None,
        help="Workspace directory (default: current directory)",
    )
    parser.add_argument(
        "-c", "--command", default=None,
        help="Run a single command and exit",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", default=False,
        help="Show detailed execution info",
    )
    parser.add_argument(
        "--no-cache", action="store_true", default=False,
        help="Disable response caching",
    )
    parser.add_argument(
        "--check", action="store_true", default=False,
        help="Run preflight check and exit",
    )
    parser.add_argument(
        "--log-level", default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Log level (default: INFO)",
    )
    return parser


def print_banner(console) -> None:
    """Print the startup banner."""
    if HAS_RICH:
        banner = Text()
        banner.append("Peanut Agent", style="bold yellow")
        banner.append(f" v{__version__}", style="dim")
        console.print(Panel(banner, subtitle="Local AI Agent with Tool Calling"))
    else:
        print(f"Peanut Agent v{__version__}")
        print("=" * 40)


def print_config_table(console, config: AgentConfig) -> None:
    """Display current configuration."""
    if HAS_RICH:
        table = Table(title="Configuration", show_header=False, border_style="dim")
        table.add_column("Key", style="cyan")
        table.add_column("Value")
        table.add_row("Model", config.model)
        table.add_row("Temperature", str(config.temperature))
        table.add_row("Max iterations", str(config.max_iterations))
        table.add_row("Workspace", config.work_dir)
        table.add_row("Cache", "enabled" if config.cache_enabled else "disabled")
        console.print(table)
    else:
        print(f"  Model: {config.model}")
        print(f"  Temperature: {config.temperature}")
        print(f"  Workspace: {config.work_dir}")


def run_preflight(agent: PeanutAgent, console) -> bool:
    """Run preflight check and display results."""
    result = agent.preflight_check()

    if HAS_RICH:
        table = Table(title="Preflight Check", show_header=False)
        table.add_column("Check", style="cyan")
        table.add_column("Status")

        ollama_ok = result["ollama_reachable"]
        model_ok = result["model_available"]

        table.add_row(
            "Ollama reachable",
            "[green]OK[/green]" if ollama_ok else f"[red]FAIL[/red] {result.get('error', '')}",
        )
        table.add_row(
            f"Model '{agent.model}'",
            "[green]Available[/green]" if model_ok else "[yellow]Not found[/yellow]",
        )

        if ollama_ok and result.get("available_models"):
            models_str = ", ".join(result["available_models"][:10])
            table.add_row("Available models", models_str)

        console.print(table)
    else:
        print(f"  Ollama reachable: {result['ollama_reachable']}")
        print(f"  Model available: {result['model_available']}")
        if "error" in result:
            print(f"  Error: {result['error']}")

    return result["ollama_reachable"]


def interactive_mode(agent: PeanutAgent, console, verbose: bool) -> None:
    """Run interactive chat loop."""
    if HAS_RICH:
        console.print(
            "\n[dim]Type your request. Use 'exit' or Ctrl+C to quit. "
            "'reset' to clear history.[/dim]\n"
        )
    else:
        print("\nType your request. Use 'exit' or Ctrl+C to quit. 'reset' to clear history.\n")

    while True:
        try:
            if HAS_RICH:
                user_input = console.input("[bold cyan]You:[/bold cyan] ").strip()
            else:
                user_input = input("You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ("exit", "quit", "salir"):
                break

            if user_input.lower() == "reset":
                agent.reset()
                if HAS_RICH:
                    console.print("[dim]History cleared.[/dim]")
                else:
                    print("History cleared.")
                continue

            if user_input.lower() == "stats":
                stats = agent.get_cache_stats()
                if HAS_RICH:
                    console.print(f"[dim]Cache stats: {stats}[/dim]")
                else:
                    print(f"Cache stats: {stats}")
                continue

            response = agent.run(user_input, verbose=verbose)

            if HAS_RICH:
                console.print(f"\n[bold green]Agent:[/bold green] {response}\n")
            else:
                print(f"\nAgent: {response}\n")

        except KeyboardInterrupt:
            print()
            break
        except Exception as exc:
            if HAS_RICH:
                console.print(f"[red]Error: {exc}[/red]")
            else:
                print(f"Error: {exc}")


def main() -> None:
    """Entry point for the peanut CLI."""
    parser = build_parser()
    args = parser.parse_args()

    setup_logging(args.log_level)

    console = Console() if HAS_RICH else None

    # Build agent
    agent = PeanutAgent(
        model=args.model,
        ollama_url=None,
        work_dir=args.work_dir,
        temperature=args.temperature,
        cache_enabled=not args.no_cache if args.no_cache else None,
    )

    if args.check:
        print_banner(console)
        ok = run_preflight(agent, console)
        sys.exit(0 if ok else 1)

    if args.command:
        # Single command mode
        response = agent.run(args.command, verbose=args.verbose)
        print(response)
        return

    # Interactive mode
    print_banner(console)
    print_config_table(console, agent.config)
    run_preflight(agent, console)
    interactive_mode(agent, console, verbose=args.verbose)

    # Show cache stats on exit
    stats = agent.get_cache_stats()
    if stats.get("total_requests", 0) > 0:
        if HAS_RICH:
            console.print(f"\n[dim]Session cache stats: {stats}[/dim]")
        else:
            print(f"\nSession cache stats: {stats}")


if __name__ == "__main__":
    main()
