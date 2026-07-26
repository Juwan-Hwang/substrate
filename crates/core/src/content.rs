//! Archive — content parsing & indexing.

/// A parsed content entry (article, project note, etc.).
#[derive(Debug, Clone)]
pub struct ContentEntry {
    pub slug: String,
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
}

/// Parse frontmatter-delimited content (simplified).
pub fn parse(raw: &str) -> ContentEntry {
    let title = raw
        .lines()
        .find(|l| l.starts_with("title:"))
        .map(|l| l.trim_start_matches("title:").trim().to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    ContentEntry {
        slug: title.to_lowercase().replace(' ', "-"),
        title,
        body: raw.to_string(),
        tags: Vec::new(),
    }
}
