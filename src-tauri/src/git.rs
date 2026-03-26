use crate::error::CascadeError;
use crate::sync_log;
use git2::{
    Cred, Direction, FetchOptions, IndexAddOption, PushOptions, RemoteCallbacks, Repository,
    Signature, StatusOptions,
};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Validate that a vault_path is a real directory and contains no traversal tricks.
fn validate_vault_path(vault_path: &str) -> Result<PathBuf, CascadeError> {
    let p = Path::new(vault_path);
    if !p.is_absolute() {
        return Err(CascadeError::InvalidPath("vault path must be absolute".into()));
    }
    let canonical = p.canonicalize().map_err(|_| {
        CascadeError::InvalidPath(format!("vault path does not exist: {}", vault_path))
    })?;
    if !canonical.is_dir() {
        return Err(CascadeError::InvalidPath("vault path is not a directory".into()));
    }
    Ok(canonical)
}

fn is_ssh_url(url: &str) -> bool {
    url.starts_with("git@") || url.starts_with("ssh://")
}

/// Resolve the SSH private key path.
/// If `custom` is non-empty, use it directly.
/// Otherwise scan ~/.ssh for common key names.
fn resolve_ssh_key(custom: &str) -> Result<PathBuf, CascadeError> {
    if !custom.is_empty() {
        // Expand ~ to home directory
        let expanded = if custom.starts_with("~/") || custom.starts_with("~\\") {
            if let Some(home) = dirs::home_dir() {
                home.join(&custom[2..])
            } else {
                PathBuf::from(custom)
            }
        } else {
            PathBuf::from(custom)
        };
        if expanded.exists() {
            return Ok(expanded);
        }
        return Err(CascadeError::Git(format!(
            "SSH key not found at: {}",
            expanded.display()
        )));
    }
    let ssh_dir = dirs::home_dir()
        .ok_or_else(|| CascadeError::Git("Cannot determine home directory".into()))?
        .join(".ssh");
    for name in &["id_ed25519", "id_rsa", "id_ecdsa"] {
        let candidate = ssh_dir.join(name);
        if candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(CascadeError::Git(
        "No SSH key found — add one in ~/.ssh or set a custom key path in Sync settings".into(),
    ))
}

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

/// Auth credentials for sync operations.
#[derive(Clone)]
enum SyncAuth {
    /// HTTPS with personal access token.
    Pat(String),
    /// SSH with path to private key.
    Ssh(PathBuf),
}

fn make_callbacks(auth: &SyncAuth) -> RemoteCallbacks<'_> {
    let mut callbacks = RemoteCallbacks::new();
    match auth {
        SyncAuth::Pat(pat) => {
            let pat = pat.clone();
            callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
                Cred::userpass_plaintext("x-access-token", &pat)
            });
        }
        SyncAuth::Ssh(key_path) => {
            let key_path = key_path.clone();
            callbacks.credentials(move |_url, username_from_url, _allowed_types| {
                let user = username_from_url.unwrap_or("git");
                Cred::ssh_key(user, None, &key_path, None)
            });
        }
    }
    callbacks
}

fn make_fetch_options(auth: &SyncAuth) -> FetchOptions<'_> {
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(make_callbacks(auth));
    fo
}

fn make_push_options(auth: &SyncAuth) -> PushOptions<'_> {
    let mut po = PushOptions::new();
    po.remote_callbacks(make_callbacks(auth));
    po
}

/// Detect the default branch name from the remote. Falls back to "main".
fn detect_default_branch(repo: &Repository) -> String {
    // Try to read the remote HEAD reference
    if let Ok(remote_head) = repo.find_reference("refs/remotes/origin/HEAD") {
        if let Some(target) = remote_head.symbolic_target() {
            if let Some(branch) = target.strip_prefix("refs/remotes/origin/") {
                return branch.to_string();
            }
        }
    }
    // Fallback: check if "main" or "master" exists
    if repo.find_reference("refs/remotes/origin/main").is_ok() {
        return "main".to_string();
    }
    if repo.find_reference("refs/remotes/origin/master").is_ok() {
        return "master".to_string();
    }
    "main".to_string()
}

fn signature() -> Result<Signature<'static>, CascadeError> {
    Signature::now("Cascade", "cascade@localhost")
        .map_err(|e| CascadeError::Git(format!("Failed to create git signature: {e}")))
}

fn ensure_gitignore(vault_path: &Path) -> Result<(), CascadeError> {
    let gitignore = vault_path.join(".gitignore");
    if !gitignore.exists() {
        let content = ".cascade/\n.DS_Store\nThumbs.db\n*.tmp\n.env\n*.key\n*.pem\ncredentials.json\n";
        fs::write(&gitignore, content)
            .map_err(|e| CascadeError::Git(format!("Failed to write .gitignore: {e}")))?;
    }
    Ok(())
}

// ── Git credential helper delegation ────────────────────────────────

/// Parse a remote URL into protocol and host for git credential.
fn parse_credential_url(remote_url: &str) -> Result<(String, String), CascadeError> {
    if let Some(rest) = remote_url.strip_prefix("https://") {
        let host = rest.split('/').next().unwrap_or("github.com").to_string();
        Ok(("https".to_string(), host))
    } else if let Some(rest) = remote_url.strip_prefix("http://") {
        let host = rest.split('/').next().unwrap_or("github.com").to_string();
        Ok(("http".to_string(), host))
    } else {
        Err(CascadeError::Git("Cannot use credential helper with non-HTTPS URL".into()))
    }
}

/// Read PAT from git credential helper. Called internally by sync functions.
fn read_pat_from_credential_helper(remote_url: &str) -> Result<String, CascadeError> {
    let (protocol, host) = parse_credential_url(remote_url)?;
    let input = format!("protocol={}\nhost={}\n\n", protocol, host);

    let output = Command::new("git")
        .args(["credential", "fill"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(stdin) = child.stdin.as_mut() {
                stdin.write_all(input.as_bytes())?;
            }
            child.wait_with_output()
        })
        .map_err(|e| CascadeError::Git(format!("git credential fill failed: {e}")))?;

    if !output.status.success() {
        return Err(CascadeError::Git("git credential fill returned non-zero".into()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(password) = line.strip_prefix("password=") {
            return Ok(password.to_string());
        }
    }

    Ok(String::new())
}

/// Store PAT via git credential helper.
fn store_pat_in_credential_helper(remote_url: &str, pat: &str) -> Result<(), CascadeError> {
    let (protocol, host) = parse_credential_url(remote_url)?;
    let input = format!(
        "protocol={}\nhost={}\nusername=x-access-token\npassword={}\n\n",
        protocol, host, pat
    );

    let output = Command::new("git")
        .args(["credential", "approve"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(stdin) = child.stdin.as_mut() {
                stdin.write_all(input.as_bytes())?;
            }
            child.wait_with_output()
        })
        .map_err(|e| CascadeError::Git(format!("git credential approve failed: {e}")))?;

    if !output.status.success() {
        return Err(CascadeError::Git("git credential approve returned non-zero".into()));
    }

    Ok(())
}

/// Delete PAT from git credential helper.
fn delete_pat_from_credential_helper(remote_url: &str) -> Result<(), CascadeError> {
    let (protocol, host) = parse_credential_url(remote_url)?;
    let input = format!(
        "protocol={}\nhost={}\nusername=x-access-token\npassword=dummy\n\n",
        protocol, host
    );

    let _ = Command::new("git")
        .args(["credential", "reject"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(stdin) = child.stdin.as_mut() {
                stdin.write_all(input.as_bytes())?;
            }
            child.wait_with_output()
        });

    Ok(())
}

/// Build a SyncAuth from the URL and optional SSH key path.
/// For HTTPS, reads the PAT internally from the git credential helper.
fn resolve_auth(remote_url: &str, ssh_key_path: &str) -> Result<SyncAuth, CascadeError> {
    if is_ssh_url(remote_url) {
        let key = resolve_ssh_key(ssh_key_path)?;
        Ok(SyncAuth::Ssh(key))
    } else {
        let pat = read_pat_from_credential_helper(remote_url)?;
        if pat.is_empty() {
            return Err(CascadeError::Git(
                "No PAT found — save your token in Sync settings".into(),
            ));
        }
        Ok(SyncAuth::Pat(pat))
    }
}

#[tauri::command]
pub fn git_test_connection(vault_path: String, remote_url: String, ssh_key_path: String) -> Result<(), CascadeError> {
    let path = validate_vault_path(&vault_path)?;
    sync_log::info(&path, &format!("Testing connection to: {}", remote_url));
    sync_log::debug(&path, &format!("Auth method: {}", if is_ssh_url(&remote_url) { "SSH" } else { "HTTPS" }));
    let auth = match resolve_auth(&remote_url, &ssh_key_path) {
        Ok(a) => a,
        Err(e) => {
            sync_log::error(&path, &format!("Auth resolution failed: {e}"));
            return Err(e);
        }
    };
    let mut remote = match git2::Remote::create_detached(&*remote_url) {
        Ok(r) => r,
        Err(e) => {
            sync_log::error(&path, &format!("Failed to create remote: {e}"));
            return Err(e.into());
        }
    };
    match remote.connect_auth(Direction::Fetch, Some(make_callbacks(&auth)), None) {
        Ok(_) => {
            sync_log::info(&path, "Connection test successful");
        }
        Err(e) => {
            sync_log::error(&path, &format!("Connection failed: {e}"));
            return Err(e.into());
        }
    }
    remote.disconnect()?;
    Ok(())
}

#[tauri::command]
pub fn git_init_repo(
    vault_path: String,
    remote_url: String,
    ssh_key_path: String,
) -> Result<(), CascadeError> {
    let auth = resolve_auth(&remote_url, &ssh_key_path)?;
    let path = validate_vault_path(&vault_path)?;
    sync_log::info(&path, &format!("Initializing repository with remote: {}", remote_url));
    ensure_gitignore(&path)?;
    let repo = Repository::init(&path)?;
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
    let mut push_opts = make_push_options(&auth);
    remote.push(&["refs/heads/main:refs/heads/main"], Some(&mut push_opts))?;
    sync_log::info(&path, "Repository initialized and initial push complete");
    Ok(())
}

#[tauri::command]
pub fn git_clone_repo(
    vault_path: String,
    remote_url: String,
    ssh_key_path: String,
) -> Result<(), CascadeError> {
    let auth = resolve_auth(&remote_url, &ssh_key_path)?;
    let fo = make_fetch_options(&auth);
    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(fo);
    let clone_path = Path::new(&vault_path);
    if !clone_path.is_absolute() {
        return Err(CascadeError::InvalidPath("vault path must be absolute".into()));
    }
    builder.clone(&remote_url, clone_path)?;
    Ok(())
}

#[tauri::command]
pub fn git_sync(vault_path: String, ssh_key_path: String) -> Result<SyncResult, CascadeError> {
    let path = validate_vault_path(&vault_path)?;
    sync_log::info(&path, "Starting sync...");
    let repo = Repository::open(&path)?;
    let remote_url = repo.find_remote("origin")?
        .url()
        .unwrap_or_default()
        .to_string();
    let auth = resolve_auth(&remote_url, &ssh_key_path)?;
    let branch = detect_default_branch(&repo);
    sync_log::debug(&path, &format!("Auth method: {}", if is_ssh_url(&remote_url) { "SSH" } else { "HTTPS" }));
    sync_log::debug(&path, &format!("Default branch: {}", branch));
    let mut conflicts = Vec::new();
    let mut conflict_details = Vec::new();

    // 1. Fetch
    {
        let mut remote = repo.find_remote("origin")?;
        let mut fo = make_fetch_options(&auth);
        if let Err(e) = remote.fetch(&[&branch as &str], Some(&mut fo), None) {
            // Network/auth failure — commit locally and report offline
            eprintln!("[cascade sync] fetch failed: {e}");
            sync_log::error(&path, &format!("Fetch failed: {e}"));
            let committed = commit_changes(&repo)?;
            return Ok(SyncResult {
                committed_files: committed,
                conflicts: vec![],
                conflict_details: vec![],
                push_status: "offline".to_string(),
            });
        }
        sync_log::debug(&path, "Fetch complete");
    }

    // 2. Merge
    let fetch_head = repo.find_reference(&format!("refs/remotes/origin/{}", branch));
    if let Ok(fetch_ref) = fetch_head {
        let fetch_commit = repo.reference_to_annotated_commit(&fetch_ref)?;
        let (analysis, _) = repo.merge_analysis(&[&fetch_commit])?;

        if analysis.is_fast_forward() {
            let refname = format!("refs/heads/{}", branch);
            if let Ok(mut reference) = repo.find_reference(&refname) {
                reference.set_target(fetch_commit.id(), "fast-forward")?;
            }
            repo.set_head(&refname)?;
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
                    sync_log::info(&path, &format!("{} conflicts detected", conflict_details.len()));
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
    if !committed.is_empty() {
        sync_log::info(&path, &format!("Committed {} files", committed.len()));
    }

    // 4. Push
    let push_status = {
        let mut remote = repo.find_remote("origin")?;
        let mut po = make_push_options(&auth);
        let push_refspec = format!("refs/heads/{0}:refs/heads/{0}", branch);
        match remote.push(&[&push_refspec as &str], Some(&mut po)) {
            Ok(_) => {
                if committed.is_empty() && conflicts.is_empty() {
                    "nothing_to_push"
                } else {
                    "pushed"
                }
            }
            Err(e) => {
                let msg = e.to_string();
                sync_log::error(&path, &format!("Push failed: {msg}"));
                if msg.contains("401") || msg.contains("403") || msg.contains("auth") {
                    "auth_error"
                } else {
                    "offline"
                }
            }
        }
        .to_string()
    };

    sync_log::info(&path, &format!("Push status: {}", push_status));
    sync_log::info(&path, "Sync complete");

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
    let path = validate_vault_path(&vault_path)?;
    let repo = match Repository::open(&path) {
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
    let changed_files = u32::try_from(statuses.len()).unwrap_or(u32::MAX);

    let mut unpushed = 0u32;
    if has_remote {
        let default_branch = detect_default_branch(&repo);
        let remote_ref_name = format!("refs/remotes/origin/{}", default_branch);
        if let (Ok(local), Ok(remote_ref)) = (
            repo.revparse_single("HEAD"),
            repo.revparse_single(&remote_ref_name),
        ) {
            if let Ok(mut revwalk) = repo.revwalk() {
                let _ = revwalk.push(local.id());
                let _ = revwalk.hide(remote_ref.id());
                unpushed = u32::try_from(revwalk.count()).unwrap_or(u32::MAX);
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
    let path = validate_vault_path(&vault_path)?;
    let repo = Repository::open(&path)?;
    repo.remote_delete("origin")?;
    Ok(())
}

#[tauri::command]
pub fn open_sync_log_folder(vault_path: String) -> Result<String, CascadeError> {
    let vp = validate_vault_path(&vault_path)?;
    let log_dir = vp.join(".cascade").join("logs");
    fs::create_dir_all(&log_dir)
        .map_err(|e| CascadeError::Git(format!("Failed to create log directory: {e}")))?;
    Ok(log_dir.to_string_lossy().into_owned())
}

// ── PAT storage: git credential helper delegation ───────────────────

/// Store PAT via git credential helper.
#[tauri::command]
pub fn store_sync_pat(vault_path: String, remote_url: String, pat: String) -> Result<(), CascadeError> {
    let path = validate_vault_path(&vault_path)?;
    sync_log::debug(&path, "Storing PAT via git credential helper");
    store_pat_in_credential_helper(&remote_url, &pat)?;
    sync_log::debug(&path, "PAT stored via git credential helper");
    Ok(())
}

/// Check if a PAT exists. Returns boolean, NEVER the actual PAT.
#[tauri::command]
pub fn has_sync_pat(vault_path: String, remote_url: String) -> Result<bool, CascadeError> {
    let path = validate_vault_path(&vault_path)?;
    let pat = read_pat_from_credential_helper(&remote_url).unwrap_or_default();
    let has = !pat.is_empty();
    sync_log::debug(&path, &format!("PAT check: {}", if has { "found" } else { "not found" }));
    Ok(has)
}

/// Delete PAT from credential store.
#[tauri::command]
pub fn delete_sync_pat(vault_path: String, remote_url: String) -> Result<(), CascadeError> {
    let path = validate_vault_path(&vault_path)?;
    sync_log::debug(&path, "Deleting PAT from git credential helper");
    delete_pat_from_credential_helper(&remote_url)?;
    sync_log::debug(&path, "PAT deleted");

    // Clean up old base64 credential file if it exists
    let old_cred = Path::new(&vault_path).join(".cascade").join("credentials");
    if old_cred.exists() {
        let _ = fs::remove_file(&old_cred);
    }

    Ok(())
}
