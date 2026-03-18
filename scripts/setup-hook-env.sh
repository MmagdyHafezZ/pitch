#!/usr/bin/env sh

add_path() {
  dir="$1"
  [ -n "$dir" ] || return 0
  [ -d "$dir" ] || return 0

  case ":$PATH:" in
    *":$dir:"*) ;;
    *) PATH="$dir:$PATH" ;;
  esac
}

ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

add_path "$ROOT/node_modules/.bin"
add_path "$ROOT/apps/api/node_modules/.bin"
add_path "$HOME/.local/bin"
add_path "$HOME/bin"
add_path "/opt/homebrew/bin"
add_path "/usr/local/bin"

if [ -f "$ROOT/.tool-versions" ]; then
  while IFS=' ' read -r tool version _rest; do
    case "$tool" in
      nodejs|pnpm|python)
        add_path "$HOME/.asdf/installs/$tool/$version/bin"
        ;;
    esac
  done < "$ROOT/.tool-versions"
fi

if [ -f "$HOME/.asdf/asdf.sh" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.asdf/asdf.sh"
  add_path "$HOME/.asdf/shims"
fi

if command -v python3 >/dev/null 2>&1; then
  USER_BASE="$(python3 -c 'import site; print(site.USER_BASE)' 2>/dev/null || true)"
  add_path "$USER_BASE/bin"
fi

export PATH
