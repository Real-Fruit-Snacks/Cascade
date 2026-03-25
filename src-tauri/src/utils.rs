/// Characters not allowed in Windows filenames.
const INVALID_FILENAME_CHARS: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

/// Sanitize a string into a safe filename by replacing forbidden characters with `_`
/// and truncating to 200 characters.
pub fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| if INVALID_FILENAME_CHARS.contains(&c) { '_' } else { c })
        .collect();
    // Truncate to 200 chars to stay safe on all file systems
    sanitized.chars().take(200).collect()
}
