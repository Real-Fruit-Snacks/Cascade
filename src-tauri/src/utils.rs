/// Characters not allowed in Windows filenames.
const INVALID_FILENAME_CHARS: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

/// Windows reserved device names (case-insensitive).
const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Sanitize a string into a safe filename by replacing forbidden characters with `_`
/// and truncating to 200 characters.
pub fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| if INVALID_FILENAME_CHARS.contains(&c) { '_' } else { c })
        .collect();
    // Truncate to 200 chars to stay safe on all file systems
    let truncated: String = sanitized.chars().take(200).collect();
    // Check if the stem (name without extension) is a Windows reserved name
    let stem = std::path::Path::new(&truncated)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&truncated);
    let stem_upper = stem.to_uppercase();
    if WINDOWS_RESERVED_NAMES.contains(&stem_upper.as_str()) {
        format!("_{}", truncated)
    } else {
        truncated
    }
}
