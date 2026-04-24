# Commit Conventions Guide

This guide covers the commit conventions, quality checks, and development
workflow for the PITCH project.

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/)
specification to ensure consistent and meaningful commit messages.

### Format Structure

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Examples

```bash
feat(web): add user authentication system
fix(api): resolve database connection timeout
docs: update API documentation
style(web): improve button component styling
refactor(api): simplify user service logic
```

## Commit Types

| Type       | Description   | When to Use                                             |
| ---------- | ------------- | ------------------------------------------------------- |
| `feat`     | New feature   | Adding new functionality                                |
| `fix`      | Bug fix       | Fixing a bug or error                                   |
| `docs`     | Documentation | Adding or updating documentation                        |
| `style`    | Code style    | Formatting, missing semicolons, etc. (no logic change)  |
| `refactor` | Refactoring   | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance   | Code change that improves performance                   |
| `test`     | Tests         | Adding or updating tests                                |
| `build`    | Build system  | Changes to build process or dependencies                |
| `ci`       | CI/CD         | Changes to continuous integration configuration         |
| `chore`    | Maintenance   | Other changes that don't modify src or test files       |
| `revert`   | Revert        | Reverting a previous commit                             |

## Commit Scopes

| Scope     | Description              | Example                                      |
| --------- | ------------------------ | -------------------------------------------- |
| `web`     | Frontend/web app changes | `feat(web): add login form`                  |
| `api`     | Backend API changes      | `fix(api): handle null user data`            |
| `shared`  | Shared package changes   | `refactor(shared): update utility functions` |
| `config`  | Configuration changes    | `chore(config): update eslint rules`         |
| `deps`    | Dependency updates       | `build(deps): upgrade react to v19`          |
| `docker`  | Docker related changes   | `feat(docker): add staging compose file`     |
| `docs`    | Documentation changes    | `docs(api): add endpoint documentation`      |
| `ci`      | CI/CD changes            | `ci: add automated testing workflow`         |
| `release` | Release related changes  | `chore(release): bump version to 1.2.0`      |

## Pre-commit Quality Checks

When you commit code, the following checks run automatically:

### 1. **Lint-Staged**

Runs on staged files only:

- **Code formatting** with Prettier
- **Linting** with ESLint (auto-fix enabled)
- **Type checking** for TypeScript files

### 2. **Type Checking**

- Runs `tsc --noEmit` for TypeScript validation
- Ensures type safety across the codebase

### 3. **Testing**

- Runs relevant tests for changed files
- Ensures existing functionality isn't broken

### 4. **Build Check**

- Verifies that the code compiles successfully
- Catches build-time errors before commit

### 5. **Commit Message Validation**

- Validates commit message format
- Ensures conventional commit standards

## Quality Check Configuration

### Prettier Configuration

```javascript
// prettier.config.js
{
  printWidth: 100,
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  trailingComma: 'es5'
}
```

### ESLint Configuration

- Next.js configuration for web app
- NestJS/TypeScript configuration for API
- Consistent rules across the monorepo

### Commitlint Rules

- Enforces conventional commit format
- Validates commit type and scope
- Ensures proper message length and case

## Development Workflow

### Making a Commit

#### Method 1: Standard Git Commit

```bash
# Stage your changes
git add .

# Commit with conventional message
git commit -m "feat(web): add user profile page"
```

#### Method 2: Interactive Commit (Recommended)

```bash
# Stage your changes
git add .

# Use commitizen for guided commit creation
pnpm commit

# Follow the interactive prompts to create a proper commit message
```

### Pre-commit Hook Flow

```
1. Stage files → 2. Run git commit → 3. Pre-commit checks
                                      ↓
                    ← 4. Commit rejected ← Checks fail
                                      ↓
                                 Checks pass
                                      ↓
                    → 5. Validate commit message → 6. Commit success
```

### If Checks Fail

#### Linting Errors

```bash
# Fix automatically
pnpm lint:fix

# Or manually fix and re-stage
git add .
```

#### Type Errors

```bash
# Check type errors
pnpm type-check

# Fix errors in your code
# Re-stage and commit
git add .
git commit -m "fix(web): resolve type errors"
```

#### Test Failures

```bash
# Run tests to see failures
pnpm test

# Fix failing tests
# Re-stage and commit
git add .
```

#### Build Failures

```bash
# Check build errors
pnpm build

# Fix build issues
# Re-stage and commit
git add .
```

## Commit Message Examples

### Good Examples ✅

```bash
# Feature additions
feat(web): add user authentication modal
feat(api): implement password reset functionality
feat(shared): add date utility functions

# Bug fixes
fix(web): resolve infinite scroll loading issue
fix(api): handle database connection errors properly
fix(docker): correct environment variable references

# Documentation
docs: update contributing guidelines
docs(api): add authentication endpoint documentation
docs(web): document component architecture

# Refactoring
refactor(web): simplify user context logic
refactor(api): extract validation middleware
refactor(shared): improve type definitions

# Multiple scope changes
feat(web,api): add real-time notifications system
```

### Bad Examples ❌

```bash
# Too vague
fix: bug fix
update: changes

# Wrong format
Add new feature
Fixed the login bug
Updated documentation

# Missing scope when needed
feat: add new button
fix: database issue

# Too long subject
feat(web): add a comprehensive user authentication system with login, logout, password reset, and email verification functionality
```

## Advanced Commit Scenarios

### Breaking Changes

```bash
feat(api)!: change authentication token format

BREAKING CHANGE: Authentication tokens now use JWT format.
Update client code to handle new token structure.
```

### Multi-line Commits

```bash
feat(web): add advanced search functionality

- Add search filters for date range
- Implement fuzzy text matching
- Add search result highlighting
- Include search history

Closes #123
```

### Reverting Commits

```bash
revert: feat(web): add user authentication modal

This reverts commit 3d7b4f2a1c5e8f9b0a2d6e7c8f1a4b5c6d9e0f2a.

Reason: Authentication integration causes performance issues.
```

## CI/CD Integration

### GitHub Actions Integration

The commit hooks work seamlessly with CI/CD:

```yaml
# .github/workflows/quality-check.yml
name: Quality Check
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test
      - run: pnpm build
```

### Pre-push Hooks (Optional)

```bash
# .husky/pre-push
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm test
pnpm build
```

## Troubleshooting

### Common Issues

**Hook doesn't run:**

```bash
# Ensure husky is installed
pnpm exec husky install

# Check hook permissions
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
```

**Commitlint fails:**

```bash
# Check your commit message format
# Ensure you follow: type(scope): description

# Valid examples:
feat(web): add login form
fix(api): resolve cors issue
docs: update readme
```

**Type check fails:**

```bash
# Run type check manually to see errors
pnpm type-check

# Fix TypeScript errors
# Re-commit
```

**Build fails:**

```bash
# Run build to see errors
pnpm build

# Common fixes:
# - Fix import/export errors
# - Resolve missing dependencies
# - Fix TypeScript configuration
```

### Skipping Hooks (Use Sparingly)

```bash
# Skip pre-commit hooks (NOT recommended)
git commit --no-verify -m "emergency fix"

# Skip commit message validation only
git commit --no-verify -m "WIP: work in progress"
```

## Best Practices

### 1. **Atomic Commits**

- One logical change per commit
- Easier to review and revert
- Better git history

### 2. **Descriptive Messages**

- Explain **what** and **why**, not **how**
- Use imperative mood ("add" not "added")
- Be specific but concise

### 3. **Proper Staging**

- Review staged changes before committing
- Use `git diff --staged` to verify changes
- Don't commit unrelated changes together

### 4. **Regular Commits**

- Commit frequently with small changes
- Don't let branches become too large
- Easier to track progress and debug

### 5. **Use Conventional Types Appropriately**

- `feat`: Only for user-facing features
- `fix`: For actual bug fixes
- `refactor`: For code improvements without behavior change
- `chore`: For maintenance tasks

## Tools and Commands

### Useful Git Commands

```bash
# View commit history with format
git log --oneline --graph --decorate

# Amend last commit message
git commit --amend -m "new message"

# Interactive rebase to clean up commits
git rebase -i HEAD~3

# View changes before committing
git diff --staged
```

### Package Scripts

```bash
# Format all code
pnpm format

# Check formatting
pnpm format:check

# Run all quality checks
pnpm lint && pnpm type-check && pnpm test && pnpm build

# Interactive commit
pnpm commit
```

## Configuration Files

### Key Files in the Project

- **`.husky/pre-commit`** - Pre-commit hook script
- **`.husky/commit-msg`** - Commit message validation hook
- **`commitlint.config.js`** - Commit message linting rules
- **`prettier.config.js`** - Code formatting configuration
- **`package.json`** - Lint-staged and commitizen configuration

### Customization

All configurations can be customized in their respective files:

- Add new commit types in `commitlint.config.js`
- Modify code formatting in `prettier.config.js`
- Update lint-staged rules in `package.json`
- Add custom hooks in `.husky/` directory
