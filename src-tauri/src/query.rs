use std::collections::HashMap;
use std::path::PathBuf;

use walkdir::WalkDir;

use crate::error::CascadeError;
use crate::indexer::{parse_frontmatter_properties, PropertyValue, FRONTMATTER_RE, INLINE_TAG_RE};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct PropertyQuery {
    pub output: String,
    pub fields: Vec<String>,
    pub from_tag: Option<String>,
    pub from_folder: Option<String>,
    pub filters: Vec<QueryFilter>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub limit: Option<u32>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryFilter {
    pub field: String,
    pub operator: String,
    pub value: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub rows: Vec<QueryRow>,
    pub total: u32,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRow {
    pub file_path: String,
    pub file_name: String,
    pub values: HashMap<String, String>,
}

fn property_value_to_string(val: &PropertyValue) -> String {
    match val {
        PropertyValue::Bool(b) => b.to_string(),
        PropertyValue::Number(n) => {
            if n.fract() == 0.0 {
                format!("{}", *n as i64)
            } else {
                n.to_string()
            }
        }
        PropertyValue::Text(s) => s.clone(),
        PropertyValue::List(items) => items.join(", "),
    }
}

fn apply_filter(props: &HashMap<String, PropertyValue>, filter: &QueryFilter) -> bool {
    let field_val = props
        .get(&filter.field)
        .map(property_value_to_string)
        .unwrap_or_default();

    match filter.operator.as_str() {
        "=" => field_val == filter.value,
        "!=" => field_val != filter.value,
        "contains" => field_val.to_lowercase().contains(&filter.value.to_lowercase()),
        ">" | "<" | ">=" | "<=" => {
            if let (Ok(a), Ok(b)) = (field_val.parse::<f64>(), filter.value.parse::<f64>()) {
                match filter.operator.as_str() {
                    ">" => a > b,
                    "<" => a < b,
                    ">=" => a >= b,
                    "<=" => a <= b,
                    _ => false,
                }
            } else {
                match filter.operator.as_str() {
                    ">" => field_val > filter.value,
                    "<" => field_val < filter.value,
                    ">=" => field_val >= filter.value,
                    "<=" => field_val <= filter.value,
                    _ => false,
                }
            }
        }
        _ => false,
    }
}

fn file_has_tag(content: &str, tag: &str) -> bool {
    let tag_lower = tag.to_lowercase();

    // Check frontmatter tags
    if let Some(fm_caps) = FRONTMATTER_RE.captures(content) {
        let yaml = fm_caps.get(1).unwrap().as_str();
        let props = parse_frontmatter_properties(yaml);
        if let Some(tags_val) = props.get("tags") {
            let tags_str = property_value_to_string(tags_val).to_lowercase();
            if tags_str
                .split(',')
                .any(|t| t.trim() == tag_lower)
            {
                return true;
            }
        }
    }

    // Check inline #tags (outside frontmatter)
    let body = FRONTMATTER_RE.replace(content, "");
    for caps in INLINE_TAG_RE.captures_iter(&body) {
        if caps.get(1).unwrap().as_str().to_lowercase() == tag_lower {
            return true;
        }
    }

    false
}

#[tauri::command]
pub async fn query_properties(vault_root: String, query: PropertyQuery) -> Result<QueryResult, CascadeError> {
    tokio::task::spawn_blocking(move || -> Result<QueryResult, CascadeError> {
        let root = PathBuf::from(&vault_root)
            .canonicalize()
            .map_err(|_| CascadeError::NotADirectory(vault_root.clone()))?;
        if !root.is_dir() {
            return Err(CascadeError::NotADirectory(vault_root));
        }

        // Determine folder filter base path
        let folder_filter: Option<PathBuf> = query.from_folder.as_ref().map(|f| root.join(f));

        let mut rows: Vec<QueryRow> = Vec::new();

        for entry in WalkDir::new(&root)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.'))
            .filter_map(|e| e.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("md") {
                continue;
            }

            // Apply folder filter
            if let Some(ref folder) = folder_filter {
                if !path.starts_with(folder) {
                    continue;
                }
            }

            let rel_path = path
                .strip_prefix(&root)
                .unwrap_or(path)
                .to_string_lossy()
                .replace('\\', "/");

            let content = match std::fs::read_to_string(path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            // Apply tag filter
            if let Some(ref tag) = query.from_tag {
                if !file_has_tag(&content, tag) {
                    continue;
                }
            }

            // Parse properties
            let props = if let Some(fm_caps) = FRONTMATTER_RE.captures(&content) {
                let yaml = fm_caps.get(1).unwrap().as_str();
                parse_frontmatter_properties(yaml)
            } else {
                HashMap::new()
            };

            // Apply WHERE filters
            if !query.filters.iter().all(|f| apply_filter(&props, f)) {
                continue;
            }

            // Build values map for requested fields
            let file_name = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            let values: HashMap<String, String> = if query.fields.is_empty() {
                props.iter().map(|(k, v)| (k.clone(), property_value_to_string(v))).collect()
            } else {
                query
                    .fields
                    .iter()
                    .map(|field| {
                        let val = props
                            .get(field)
                            .map(property_value_to_string)
                            .unwrap_or_default();
                        (field.clone(), val)
                    })
                    .collect()
            };

            rows.push(QueryRow {
                file_path: rel_path,
                file_name,
                values,
            });
        }

        // Sort
        if let Some(ref sort_field) = query.sort_by {
            let descending = query
                .sort_order
                .as_deref()
                .map(|o| o.eq_ignore_ascii_case("desc"))
                .unwrap_or(false);

            rows.sort_by(|a, b| {
                let av = a.values.get(sort_field).map(|s| s.as_str()).unwrap_or("");
                let bv = b.values.get(sort_field).map(|s| s.as_str()).unwrap_or("");
                // Try numeric comparison first
                match (av.parse::<f64>(), bv.parse::<f64>()) {
                    (Ok(an), Ok(bn)) => {
                        let ord = an.partial_cmp(&bn).unwrap_or(std::cmp::Ordering::Equal);
                        if descending { ord.reverse() } else { ord }
                    }
                    _ => {
                        let ord = av.cmp(bv);
                        if descending { ord.reverse() } else { ord }
                    }
                }
            });
        }

        // Apply limit
        let total = rows.len() as u32;
        if let Some(limit) = query.limit {
            rows.truncate(limit as usize);
        }

        Ok(QueryResult { rows, total })
    })
    .await
    .map_err(|e| CascadeError::InvalidPath(e.to_string()))?
}
