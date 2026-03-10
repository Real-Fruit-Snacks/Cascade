use crate::error::CascadeError;
use git2::{
    Cred, Direction, FetchOptions, IndexAddOption, PushOptions, RemoteCallbacks, Repository,
    Signature, StatusOptions,
};
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Clone)]
pub struct ConflictInfo {
    pub path: String,
    pub local_content: String,
    pub remote_content: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct SyncResult {
    pub committed_files: Vec<String>,
    pub conflicts: Vec<String>,
    pub conflict_details: Vec<ConflictInfo>,
    pub push_status: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct GitStatus {
    pub is_repo: bool,
    pub has_remote: bool,
    pub changed_files: u32,
    pub unpushed_commits: u32,
}

fn make_callbacks<'a>(pat: &'a str) -> RemoteCallbacks<'a> {
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
        Cred::userpass_plaintext("x-access-token", pat)
    });
    callbacks
}

fn make_fetch_options<'a>(pat: &'a str) -> FetchOptions<'a> {
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(make_callbacks(pat));
    fo
}

fn make_push_options<'a>(pat: &'a str) -> PushOptions<'a> {
    let mut po = PushOptions::new();
    po.remote_callbacks(make_callbacks(pat));
    po
}

fn signature() -> Result<Signature<'static>, CascadeError> {
    Signature::now("Cascade", "cascade@localhost")
        .map_err(|e| CascadeError::Git(format!("Failed to create git signature: {e}")))
}

fn ensure_gitignore(vault_path: &Path) -> Result<(), CascadeError> {
    let gitignore = vault_path.join(".gitignore");
    if !gitignore.exists() {
        let content = ".cascade/\n.DS_Store\nThumbs.db\n*.tmp\n";
        fs::write(&gitignore, content)
            .map_err(|e| CascadeError::Git(format!("Failed to write .gitignore: {e}")))?;
    }
    Ok(())
}

#[tauri::command]
pub fn git_test_connection(remote_url: String, pat: String) -> Result<(), CascadeError> {
    let mut remote = git2::Remote::create_detached(&*remote_url)?;
    remote.connect_auth(Direction::Fetch, Some(make_callbacks(&pat)), None)?;
    remote.disconnect()?;
    Ok(())
}

#[tauri::command]
pub fn git_init_repo(
    vault_path: String,
    remote_url: String,
    pat: String,
) -> Result<(), CascadeError> {
    let path = Path::new(&vault_path);
    ensure_gitignore(path)?;
    let repo = Repository::init(path)?;
    repo.remote("origin", &remote_url)?;

    let mut index = repo.index()?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    index.write()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let sig = signature()?;
    repo.commit(Some("HEAD"), &sig, &sig, "Initial vault backup", &tree, &[])?;

    // Create main branch ref and push
    let head = repo.head()?.peel_to_commit()?;
    repo.branch("main", &head, true)?;
    repo.set_head("refs/heads/main")?;

    let mut remote = repo.find_remote("origin")?;
    let mut push_opts = make_push_options(&pat);
    remote.push(&["refs/heads/main:refs/heads/main"], Some(&mut push_opts))?;
    Ok(())
}

#[tauri::command]
pub fn git_clone_repo(
    vault_path: String,
    remote_url: String,
    pat: String,
) -> Result<(), CascadeError> {
    let fo = make_fetch_options(&pat);
    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(fo);
    builder.clone(&remote_url, Path::new(&vault_path))?;
    Ok(())
}

#[tauri::command]
pub fn git_sync(vault_path: String, pat: String) -> Result<SyncResult, CascadeError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path)?;
    let mut conflicts = Vec::new();
    let mut conflict_details = Vec::new();

    // 1. Fetch
    {
        let mut remote = repo.find_remote("origin")?;
        let mut fo = make_fetch_options(&pat);
        if let Err(e) = remote.fetch(&["main"], Some(&mut fo), None) {
            // Network/auth failure — commit locally and report offline
            eprintln!("[cascade sync] fetch failed: {e}");
            let committed = commit_changes(&repo)?;
            return Ok(SyncResult {
                committed_files: committed,
                conflicts: vec![],
                conflict_details: vec![],
                push_status: "offline".to_string(),
            });
        }
    }

    // 2. Merge
    let fetch_head = repo.find_reference("refs/remotes/origin/main");
    if let Ok(fetch_ref) = fetch_head {
        let fetch_commit = repo.reference_to_annotated_commit(&fetch_ref)?;
        let (analysis, _) = repo.merge_analysis(&[&fetch_commit])?;

        if analysis.is_fast_forward() {
            let refname = "refs/heads/main";
            if let Ok(mut reference) = repo.find_reference(refname) {
                reference.set_target(fetch_commit.id(), "fast-forward")?;
            }
            repo.set_head(refname)?;
            repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
        } else if analysis.is_normal() {
            let their_commit = repo.find_commit(fetch_commit.id())?;
            repo.merge(&[&fetch_commit], None, None)?;

            let has_conflicts = {
                let idx = repo.index()?;
                idx.has_conflicts()
            };

            if has_conflicts {
                // Collect conflict info with both local and remote content
                {
                    let idx = repo.index()?;
                    let conflict_entries: Vec<_> =
                        idx.conflicts()?.filter_map(|c| c.ok()).collect();
                    for conflict in &conflict_entries {
                        let their_path = conflict.their.as_ref()
                            .or(conflict.our.as_ref())
                            .map(|e| String::from_utf8_lossy(&e.path).to_string())
                            .unwrap_or_default();

                        let local_content = conflict.our.as_ref()
                            .and_then(|e| repo.find_blob(e.id).ok())
                            .map(|b| String::from_utf8_lossy(b.content()).to_string())
                            .unwrap_or_default();

                        let remote_content = conflict.their.as_ref()
                            .and_then(|e| repo.find_blob(e.id).ok())
                            .map(|b| String::from_utf8_lossy(b.content()).to_string())
                            .unwrap_or_default();

                        // Write .conflict.md for backwards compat
                        if their_path.ends_with(".md") && !remote_content.is_empty() {
                            let conflict_path = their_path.replace(".md", ".conflict.md");
                            let full_path = path.join(&conflict_path);
                            let _ = fs::write(&full_path, &remote_content);
                            conflicts.push(conflict_path);
                        }

                        conflict_details.push(ConflictInfo {
                            path: their_path,
                            local_content,
                            remote_content,
                        });
                    }
                }

                // Resolve conflicts by keeping our side
                {
                    let mut idx = repo.index()?;
                    let entries: Vec<_> = idx.conflicts()?.filter_map(|c| c.ok()).collect();
                    for conflict in entries {
                        if let Some(mut our) = conflict.our {
                            our.flags = 0;
                            idx.add(&our)?;
                        }
                    }
                    idx.write()?;

                    let tree_id = idx.write_tree()?;
                    let tree = repo.find_tree(tree_id)?;
                    let sig = signature()?;
                    let head = repo.head()?.peel_to_commit()?;
                    repo.commit(
                        Some("HEAD"),
                        &sig,
                        &sig,
                        "Merge remote changes (conflicts resolved with local)",
                        &tree,
                        &[&head, &their_commit],
                    )?;
                }
                repo.cleanup_state()?;
            } else {
                let mut idx = repo.index()?;
                let tree_id = idx.write_tree()?;
                let tree = repo.find_tree(tree_id)?;
                let sig = signature()?;
                let head = repo.head()?.peel_to_commit()?;
                repo.commit(
                    Some("HEAD"),
                    &sig,
                    &sig,
                    "Merge remote changes",
                    &tree,
                    &[&head, &their_commit],
                )?;
                repo.cleanup_state()?;
            }
        }
    }

    // 3. Commit local changes
    let committed = commit_changes(&repo)?;

    // 4. Push
    let push_status = {
        let mut remote = repo.find_remote("origin")?;
        let mut po = make_push_options(&pat);
        match remote.push(&["refs/heads/main:refs/heads/main"], Some(&mut po)) {
            Ok(_) => {
                if committed.is_empty() && conflicts.is_empty() {
                    "nothing_to_push"
                } else {
                    "pushed"
                }
            }
            Err(e) => {
                eprintln!("[cascade sync] push failed: {e}");
                "offline"
            }
        }
        .to_string()
    };

    Ok(SyncResult {
        committed_files: committed,
        conflicts,
        conflict_details,
        push_status,
    })
}

fn commit_changes(repo: &Repository) -> Result<Vec<String>, CascadeError> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    let statuses = repo.statuses(Some(&mut opts))?;
    if statuses.is_empty() {
        return Ok(vec![]);
    }

    let changed: Vec<String> = statuses
        .iter()
        .filter_map(|s| s.path().map(|p| p.to_string()))
        .collect();

    let mut index = repo.index()?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    index.update_all(["*"].iter(), None)?;
    index.write()?;

    let msg = if changed.len() <= 5 {
        format!("update: {}", changed.join(", "))
    } else {
        format!(
            "update: {} + {} more",
            changed[..5].join(", "),
            changed.len() - 5
        )
    };

    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let sig = signature()?;

    match repo.head() {
        Ok(h) => {
            let parent = h.peel_to_commit()?;
            repo.commit(Some("HEAD"), &sig, &sig, &msg, &tree, &[&parent])?;
        }
        Err(_) => {
            repo.commit(Some("HEAD"), &sig, &sig, &msg, &tree, &[])?;
        }
    }

    Ok(changed)
}

#[tauri::command]
pub fn git_status(vault_path: String) -> Result<GitStatus, CascadeError> {
    let path = Path::new(&vault_path);
    let repo = match Repository::open(path) {
        Ok(r) => r,
        Err(_) => {
            return Ok(GitStatus {
                is_repo: false,
                has_remote: false,
                changed_files: 0,
                unpushed_commits: 0,
            })
        }
    };

    let has_remote = repo.find_remote("origin").is_ok();
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    let statuses = repo.statuses(Some(&mut opts))?;
    let changed_files = statuses.len() as u32;

    let mut unpushed = 0u32;
    if has_remote {
        if let (Ok(local), Ok(remote_ref)) = (
            repo.revparse_single("HEAD"),
            repo.revparse_single("refs/remotes/origin/main"),
        ) {
            if let Ok(mut revwalk) = repo.revwalk() {
                let _ = revwalk.push(local.id());
                let _ = revwalk.hide(remote_ref.id());
                unpushed = revwalk.count() as u32;
            }
        }
    }

    Ok(GitStatus {
        is_repo: true,
        has_remote,
        changed_files,
        unpushed_commits: unpushed,
    })
}

#[tauri::command]
pub fn git_disconnect(vault_path: String) -> Result<(), CascadeError> {
    let repo = Repository::open(Path::new(&vault_path))?;
    repo.remote_delete("origin")?;
    Ok(())
}

// ── Secure PAT storage via OS credential store ──────────────────────

const KEYRING_SERVICE: &str = "com.matt.cascade";

fn keyring_key(vault_path: &str) -> String {
    format!("sync-pat:{}", vault_path)
}

#[tauri::command]
pub fn store_sync_pat(vault_path: String, pat: String) -> Result<(), CascadeError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &keyring_key(&vault_path))
        .map_err(|e| CascadeError::Git(format!("Keyring error: {e}")))?;
    entry
        .set_password(&pat)
        .map_err(|e| CascadeError::Git(format!("Failed to store PAT: {e}")))?;
    Ok(())
}

#[tauri::command]
pub fn read_sync_pat(vault_path: String) -> Result<String, CascadeError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &keyring_key(&vault_path))
        .map_err(|e| CascadeError::Git(format!("Keyring error: {e}")))?;
    match entry.get_password() {
        Ok(pat) => Ok(pat),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(CascadeError::Git(format!("Failed to read PAT: {e}"))),
    }
}

#[tauri::command]
pub fn delete_sync_pat(vault_path: String) -> Result<(), CascadeError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &keyring_key(&vault_path))
        .map_err(|e| CascadeError::Git(format!("Keyring error: {e}")))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(CascadeError::Git(format!("Failed to delete PAT: {e}"))),
    }
}
