//! Archive — content parsing & indexing.

use serde::{Deserialize, Serialize};

/// A parsed content entry (article, project note, etc.).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentEntry {
    pub slug: String,
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub excerpt: Option<String>,
}

/// Parse frontmatter-delimited content.
///
/// Expects `---\ntitle: Foo\ntags: [a, b]\n---\nBody...` format.
pub fn parse(raw: &str) -> ContentEntry {
    let (frontmatter, body) = split_frontmatter(raw);

    let title = frontmatter
        .lines()
        .find_map(|l| l.strip_prefix("title:").map(|v| v.trim().to_string()))
        .unwrap_or_else(|| "Untitled".to_string());

    let tags = frontmatter
        .lines()
        .find_map(|l| {
            l.strip_prefix("tags:")
                .map(|v| parse_tag_list(v.trim()))
        })
        .unwrap_or_default();

    let excerpt = frontmatter
        .lines()
        .find_map(|l| l.strip_prefix("excerpt:").map(|v| v.trim().trim_matches('"').to_string()));

    let slug = slugify(&title);

    ContentEntry { slug, title, body, tags, excerpt }
}

fn split_frontmatter(raw: &str) -> (String, String) {
    let trimmed = raw.trim_start();
    if let Some(rest) = trimmed.strip_prefix("---\n") {
        if let Some(end) = rest.find("\n---\n") {
            let fm = rest[..end].to_string();
            let body = rest[end + 5..].trim().to_string();
            return (fm, body);
        }
        if let Some(end) = rest.find("\n---") {
            let fm = rest[..end].to_string();
            let body = rest[end + 4..].trim().to_string();
            return (fm, body);
        }
    }
    (String::new(), raw.to_string())
}

fn parse_tag_list(s: &str) -> Vec<String> {
    let s = s.trim().trim_start_matches('[').trim_end_matches(']');
    if s.is_empty() {
        return Vec::new();
    }
    s.split(',').map(|t| t.trim().trim_matches('"').to_string()).collect()
}

fn slugify(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| match c {
            ' ' | '/' | '_' => '-',
            c if c.is_alphanumeric() || c == '-' => c,
            _ => '-',
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_frontmatter() {
        let raw = "---\ntitle: Hello World\ntags: [rust, wasm]\nexcerpt: \"A test\"\n---\nBody text here.";
        let entry = parse(raw);
        assert_eq!(entry.title, "Hello World");
        assert_eq!(entry.slug, "hello-world");
        assert_eq!(entry.tags, vec!["rust", "wasm"]);
        assert_eq!(entry.excerpt.as_deref(), Some("A test"));
        assert_eq!(entry.body, "Body text here.");
    }

    #[test]
    fn parses_without_frontmatter() {
        let entry = parse("Just some text");
        assert_eq!(entry.title, "Untitled");
        assert!(entry.tags.is_empty());
    }
}
