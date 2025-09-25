# Security Guidelines

## Secret Detection

This project uses [detect-secrets](https://github.com/Yelp/detect-secrets) to prevent accidentally committing sensitive information.

### How it works

1. **Pre-commit hook**: Every commit is scanned for potential secrets
2. **Baseline file**: `.secrets.baseline` contains approved/known secrets that are safe
3. **Configuration**: `.secrets.yaml` configures detection rules and exclusions

### When commits are blocked

If detect-secrets finds potential secrets, your commit will be blocked with a message:

```
❌ New secrets detected!
Current secrets: 5, Baseline: 3

What to do next:
1. Review the detected secrets
2. If they are false positives or acceptable secrets:
   cp /tmp/tmp.abc123 .secrets.baseline
3. If they are real secrets, remove them and use environment variables
4. Then commit again
```

### Handling detected secrets

#### Option 1: Remove the secret (Recommended)
- Replace hardcoded secrets with environment variables
- Use `.env` files (never commit these)
- Use configuration management systems

#### Option 2: Add to baseline (Only for false positives)
If the detected item is not actually a secret:

```bash
# Update the baseline to include the new "secrets"
detect-secrets scan --exclude-files '^\.git/' --exclude-files '^node_modules/' > .secrets.baseline

# Commit the updated baseline
git add .secrets.baseline
git commit -m "update secrets baseline"
```

### Manual scanning

You can manually scan for secrets:

```bash
# Scan current files
./scripts/check-secrets.sh

# Full scan with detailed output
detect-secrets scan --suppress-unscannable-file-warnings
```

### Configuration

The detection is configured in `.secrets.yaml` and excludes:
- `.env.example` files
- `node_modules/`
- Generated files (`dist/`, `*.min.js`)
- Migration files
- Lock files (`pnpm-lock.yaml`)

### Best practices

1. **Never commit real secrets**: Use environment variables instead
2. **Use example files**: Create `.env.example` with dummy values
3. **Rotate exposed secrets**: If you accidentally commit a secret, rotate it immediately
4. **Review baseline regularly**: Audit `.secrets.baseline` periodically

```bash
# Audit existing baseline secrets
detect-secrets audit .secrets.baseline
```

### Common false positives

- Long random strings in tests or examples
- Configuration template values
- Public keys or certificates
- UUIDs and generated IDs

These can be safely added to the baseline after review.