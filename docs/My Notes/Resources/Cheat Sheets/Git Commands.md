# Git Commands

A quick reference for everyday git workflows. #coding #reference

---

## Basics

```bash
git init                        # Initialize a new repository
git clone <url>                 # Clone a remote repository
git status                      # Show working tree status
git add <file>                  # Stage a file
git add .                       # Stage all changes
git commit -m "message"         # Commit with a message
git push origin <branch>        # Push to remote
git pull                        # Fetch and merge from remote
git log --oneline               # Compact commit history
git diff                        # Show unstaged changes
```

---

## Branching

```bash
git branch                      # List local branches
git branch <name>               # Create a new branch
git checkout <name>             # Switch to a branch
git checkout -b <name>          # Create and switch in one step
git merge <branch>              # Merge branch into current
git branch -d <name>            # Delete a branch (safe)
git branch -D <name>            # Delete a branch (force)
git rebase main                 # Rebase current branch onto main
```

---

## Undoing Changes

```bash
git restore <file>              # Discard unstaged changes
git restore --staged <file>     # Unstage a file
git revert <commit>             # Create a revert commit
git reset --soft HEAD~1         # Undo last commit, keep changes staged
git reset --hard HEAD~1         # Undo last commit, discard changes
git stash                       # Stash current changes
git stash pop                   # Re-apply stashed changes
git stash list                  # List all stashes
```

---

## Tips

- Use `git log --graph --oneline --all` for a visual branch view
- Alias common commands: `git config --global alias.st status`
- Sign commits with GPG for verified history
- Write commit messages in imperative mood: "Add feature" not "Added feature"

---

## Related

- [[Build a Personal Website]]
- [[The Pragmatic Programmer]]
