# Replace an existing Claude Code PAUL installation

Use this fork's checkout, not `npx paul-framework@latest` (the public upstream package). Installation changes Claude Code command/framework files only. It never migrates or rewrites project `.paul` data. Existing PLANs, SUMMARYs, handoffs and project rules remain available.

From the fork directory:

```bash
node bin/install.js --project /home/roman/workspace/blisstribute --dry-run
node bin/install.js --project /home/roman/workspace/blisstribute

node bin/install.js --project /home/roman/workspace/absencia --dry-run
node bin/install.js --project /home/roman/workspace/absencia
```

Restart Claude Code, then run `/paul:resume`. Commands remain `/paul:plan`, `/paul:apply`, `/paul:unify`, etc. Bash permission is now needed by the core commands to run the Node helper. No Codex installation is required.

Other targets:

```bash
node bin/install.js --global                # ~/.claude (or CLAUDE_CONFIG_DIR)
node bin/install.js --local                 # current directory/.claude
node bin/install.js --config-dir /path/to/claude-config
```

Local and global installations are separate. Upgrade the installation actually used by each project; an old local command can shadow a global update.

## What the installer preserves

- Other Claude commands/plugins and unowned PAUL files.
- Custom `## Extensions` tails where that hook remains available.
- Local customizations to upstream core files that this release has not changed.
- All project data, including an explicitly symlinked `.paul` directory.

For changed core files, known stock v1.4 content or the previous managed version upgrades automatically. Unrecognized custom content causes a conflict before any installation writes. `--dry-run` reports paths (exit code 2 for conflicts). Review and merge those changes first, or deliberately use `--replace-customized` to replace them with this fork after backup. Preserve any needed custom behavior in the resulting files. The flag is not required for the two tested project snapshots.

Framework `@src/workflows`, references and template paths are resolved to their installed location. Project source references remain project-relative. Managed installation files and nested runtime paths may not be symlinks; the selected project's top-level `.paul` link is resolved explicitly.

## Backup and rollback

Every changed installation gets a backup in `<claude-config>/paul-backups/<ID>/` and prints its ID:

```bash
node bin/install.js --project /home/roman/workspace/absencia --rollback BACKUP_ID --dry-run
node bin/install.js --project /home/roman/workspace/absencia --rollback BACKUP_ID
```

Rollback restores replaced/removed files and removes files newly created by that installation. It refuses later edits that differ from both the old and installed content. It validates backup hashes before restoring. A partially completed installation/rollback can be rolled back using its backup ID; already restored content is accepted. After a hard process interruption, inspect `paul-install.lock` and its process before removing a stale lock.

Installation rollback does not undo subsequent project work. Runtime state transitions have separate `.paul/runtime/history/` archives and a recovery journal; see RUNTIME.md. Empty created directories and the backup itself remain after rollback.

## Portable package from this fork

```bash
npm pack --pack-destination /tmp
mkdir -p /tmp/paul-optimized
tar -xzf /tmp/paul-framework-1.5.0.tgz -C /tmp/paul-optimized
node /tmp/paul-optimized/package/bin/install.js --project /absolute/project --dry-run
node /tmp/paul-optimized/package/bin/install.js --project /absolute/project
```

No npm dependencies or network download are needed for installation from the checkout or tarball. Node >=16.7 is required. The upstream package name is retained for compatibility; this fork has not been published to npm.
