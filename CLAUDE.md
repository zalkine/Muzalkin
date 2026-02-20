# CLAUDE.md

This file provides guidance for AI assistants (e.g. Claude) working in this repository.

## Repository Status

This is a freshly initialized repository with no source code yet. The sections below define the intended conventions and workflows to follow as the project is built out.

## Project Overview

- **Repository:** Muzalkin
- **Remote:** `http://local_proxy@127.0.0.1:18873/git/zalkine/Muzalkin`
- **Primary branch:** `main` (or as designated per task)
- **Development branches:** prefixed with `claude/`

## Environment

- **Node.js:** v22.22.0 (available on this machine)
- **Shell:** bash
- **Platform:** Linux

## Git Workflow

### Branching

- Feature/AI branches must follow the pattern `claude/<descriptor>-<session-id>`
- Never push directly to `main` without explicit permission
- Always create a branch locally if it does not exist before committing

### Commit Messages

Use clear, imperative-mood messages:

```
Add user authentication module
Fix null-pointer in payment service
Refactor API client to use async/await
```

### Push

Always push with tracking:

```bash
git push -u origin <branch-name>
```

Retry on network failure with exponential backoff: 2s, 4s, 8s, 16s.

## Development Commands

> These will be populated once the project stack is established. Update this section when `package.json`, `Makefile`, or equivalent build files are added.

| Task        | Command              |
|-------------|----------------------|
| Install     | _(TBD)_              |
| Build       | _(TBD)_              |
| Test        | _(TBD)_              |
| Lint        | _(TBD)_              |
| Format      | _(TBD)_              |

## Code Conventions

- Prefer editing existing files over creating new ones
- Delete unused code rather than commenting it out
- Do not add docstrings, comments, or type annotations to code that was not changed
- Avoid backwards-compatibility shims unless explicitly required
- Keep solutions minimal — only implement what is asked

## Security

- Never commit secrets, `.env` files, or credentials
- Validate input at system boundaries (user input, external APIs)
- Follow OWASP Top 10 guidelines when writing web-facing code

## Updating This File

When the project stack is decided (language, framework, test runner, linter), update:
1. The **Development Commands** table
2. Add a **Directory Structure** section describing `src/`, `tests/`, etc.
3. Add framework-specific conventions (naming, file layout, patterns)
