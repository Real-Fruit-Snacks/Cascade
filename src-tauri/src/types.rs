use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
    pub modified: f64,
}

#[derive(Serialize, Clone)]
pub struct FsChangeEvent {
    pub kind: String,
    pub path: String,
}
