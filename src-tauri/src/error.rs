use std::fmt;

#[derive(Debug)]
pub enum CascadeError {
    NotADirectory(String),
    PathTraversal { requested: String, vault: String },
    Io(std::io::Error),
    InvalidPath(String),
    InvalidRegex(String),
    Import(String),
}

impl fmt::Display for CascadeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CascadeError::NotADirectory(path) => write!(f, "Not a directory: {}", path),
            CascadeError::PathTraversal { requested, vault } => write!(
                f,
                "Path escape rejected: {:?} is outside vault {:?}",
                requested, vault
            ),
            CascadeError::Io(e) => write!(f, "IO error: {}", e),
            CascadeError::InvalidPath(msg) => write!(f, "Invalid path: {}", msg),
            CascadeError::InvalidRegex(msg) => write!(f, "Invalid regex: {}", msg),
            CascadeError::Import(msg) => write!(f, "Import error: {}", msg),
        }
    }
}

impl std::error::Error for CascadeError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            CascadeError::Io(e) => Some(e),
            _ => None,
        }
    }
}

impl From<std::io::Error> for CascadeError {
    fn from(e: std::io::Error) -> Self {
        CascadeError::Io(e)
    }
}

impl From<zip::result::ZipError> for CascadeError {
    fn from(e: zip::result::ZipError) -> Self {
        CascadeError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
    }
}

impl From<CascadeError> for tauri::ipc::InvokeError {
    fn from(e: CascadeError) -> Self {
        tauri::ipc::InvokeError::from(e.to_string())
    }
}
