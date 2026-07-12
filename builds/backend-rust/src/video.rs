use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VideoStatus {
    Live,
    Pending,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecisionReason {
    TagMatch,
    NoTag,
    NoApiKey,
    ApiError,
}

impl DecisionReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::TagMatch => "tag_match",
            Self::NoTag => "no_tag",
            Self::NoApiKey => "no_api_key",
            Self::ApiError => "api_error",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Decision {
    pub status: VideoStatus,
    pub reason: DecisionReason,
}

impl Decision {
    pub const fn live(reason: DecisionReason) -> Self {
        Self {
            status: VideoStatus::Live,
            reason,
        }
    }

    pub const fn pending(reason: DecisionReason) -> Self {
        Self {
            status: VideoStatus::Pending,
            reason,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TagLookupFailure {
    NoApiKey,
    ApiError,
}

pub fn decide(tags: Option<&[String]>, failure: Option<TagLookupFailure>) -> Decision {
    if let Some(failure) = failure {
        return Decision::pending(match failure {
            TagLookupFailure::NoApiKey => DecisionReason::NoApiKey,
            TagLookupFailure::ApiError => DecisionReason::ApiError,
        });
    }
    if tags
        .unwrap_or_default()
        .iter()
        .any(|tag| tag.eq_ignore_ascii_case("deadlock"))
    {
        Decision::live(DecisionReason::TagMatch)
    } else {
        Decision::pending(DecisionReason::NoTag)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeedVideo {
    pub yt_video_id: String,
    pub title: String,
    pub description: String,
    pub published_at: DateTime<Utc>,
    pub thumbnail_url: String,
}

pub fn parse_feed(xml: &str) -> anyhow::Result<Vec<FeedVideo>> {
    let document = roxmltree::Document::parse(xml)?;
    document
        .descendants()
        .filter(|node| node.has_tag_name(("http://www.w3.org/2005/Atom", "entry")))
        .map(|entry| {
            let text = |name| {
                entry
                    .descendants()
                    .find(|node| node.is_element() && node.tag_name().name() == name)
                    .and_then(|node| node.text())
                    .unwrap_or_default()
                    .trim()
                    .to_string()
            };
            let published_at = text("published").parse::<DateTime<Utc>>()?;
            let thumbnail_url = entry
                .descendants()
                .find(|node| node.is_element() && node.tag_name().name() == "thumbnail")
                .and_then(|node| node.attribute("url"))
                .unwrap_or_default()
                .to_string();
            Ok(FeedVideo {
                yt_video_id: text("videoId"),
                title: text("title"),
                description: text("description"),
                published_at,
                thumbnail_url,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decide_requires_case_insensitive_deadlock_tag() {
        assert_eq!(
            decide(Some(&["Guide".into(), "DeAdLoCk".into()]), None),
            Decision::live(DecisionReason::TagMatch)
        );
        assert_eq!(
            decide(Some(&["Guide".into()]), None),
            Decision::pending(DecisionReason::NoTag)
        );
    }

    #[test]
    fn decide_is_pending_without_key_or_after_api_error() {
        assert_eq!(
            decide(None, Some(TagLookupFailure::NoApiKey)),
            Decision::pending(DecisionReason::NoApiKey)
        );
        assert_eq!(
            decide(None, Some(TagLookupFailure::ApiError)),
            Decision::pending(DecisionReason::ApiError)
        );
    }

    #[test]
    fn parses_youtube_atom_fixture() {
        let videos =
            parse_feed(include_str!("../tests/fixtures/youtube-feed.xml")).expect("fixture parses");
        assert_eq!(videos.len(), 2);
        assert_eq!(videos[0].yt_video_id, "video-001");
        assert_eq!(videos[0].title, "Deadlock Grundlagen");
        assert_eq!(videos[0].description, "Laning und Souls");
        assert_eq!(
            videos[0].thumbnail_url,
            "https://i.ytimg.com/vi/video-001/hqdefault.jpg"
        );
        assert_eq!(
            videos[0].published_at.to_rfc3339(),
            "2026-07-10T17:30:00+00:00"
        );
    }
}
