# AI Agent Instructions

## Merge Conflict Resolution

If asked to fix a merge conflict:

• **Examine the current branch** and its pull request at https://github.com/austontroyer/reeltap
• **Resolve conflicts** blocking merge to remote main and commit the fix
• **Ignore all other branches** - focus only on the current branch
• **Authenticate to GitHub** using the `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable

### Security Note
The GitHub Personal Access Token should be stored as an environment variable in your `.env.local` file:

```bash
GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here
```

**Never commit tokens to version control.** Add `.env.local` to your `.gitignore` to prevent accidental commits.

### Usage
The agent will automatically use the token from the environment variable when accessing GitHub APIs for conflict resolution. 