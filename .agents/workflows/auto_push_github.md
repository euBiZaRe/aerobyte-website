---
description: Auto-push all website changes to GitHub after every edit session
---

# Auto-Push to GitHub

After making any changes to files in `a:\Website\aerobyte-website`, always run the following steps to push to GitHub.

> NOTE: `discord_sync_bot_universal.py` is intentionally excluded from git (it contains secrets). Do NOT force-add it.

// turbo-all

1. Stage all non-ignored changes:
```
git add -A
```

2. Commit with a descriptive message summarizing the changes made:
```
git commit -m "feat: <short description of changes>"
```

3. Push to GitHub:
```
git push
```

**Working directory**: Always run these commands from `a:\Website\aerobyte-website`.
