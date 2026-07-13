CREATE SCHEMA IF NOT EXISTS video_library;

CREATE TABLE video_library.channels (
    id BIGSERIAL PRIMARY KEY,
    owner_discord_id BIGINT NOT NULL,
    youtube_channel_id TEXT NOT NULL UNIQUE,
    youtube_url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    detached_at TIMESTAMPTZ
);

CREATE TABLE video_library.channel_audit_log (
    id BIGSERIAL PRIMARY KEY,
    channel_id BIGINT REFERENCES video_library.channels(id),
    actor_discord_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('registered', 'detached')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE video_library.videos (
    id BIGSERIAL PRIMARY KEY,
    channel_id BIGINT REFERENCES video_library.channels(id),
    yt_video_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    published_at TIMESTAMPTZ NOT NULL,
    thumbnail_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('live', 'pending', 'hidden')),
    source TEXT NOT NULL CHECK (source IN ('rss', 'backfill', 'manual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE video_library.decision_log (
    id BIGSERIAL PRIMARY KEY,
    video_id BIGINT REFERENCES video_library.videos(id) ON DELETE CASCADE,
    yt_video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    verdict TEXT NOT NULL CHECK (verdict IN ('live', 'pending')),
    reason TEXT NOT NULL CHECK (reason IN ('tag_match', 'no_tag', 'no_api_key', 'api_error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE video_library.taxonomy (
    id BIGSERIAL PRIMARY KEY,
    dimension TEXT NOT NULL CHECK (dimension IN ('type', 'hero', 'level')),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (dimension, slug)
);

INSERT INTO video_library.taxonomy (dimension, name, slug) VALUES
('type','Guide','guide'),('type','Gameplay','gameplay'),('type','Montage/Highlights','montage-highlights'),
('type','Patch-Analyse','patch-analyse'),('type','Build-Video','build-video'),
('level','Anfänger','anfaenger'),('level','Fortgeschritten','fortgeschritten'),('level','Alle','alle'),
('hero','Abrams','abrams'),('hero','Apollo','apollo'),('hero','Bebop','bebop'),('hero','Billy','billy'),
('hero','Calico','calico'),('hero','Celeste','celeste'),('hero','Drifter','drifter'),('hero','Dynamo','dynamo'),
('hero','Graves','graves'),('hero','Grey Talon','grey-talon'),('hero','Haze','haze'),('hero','Holliday','holliday'),
('hero','Infernus','infernus'),('hero','Ivy','ivy'),('hero','Kelvin','kelvin'),('hero','Lady Geist','lady-geist'),
('hero','Lash','lash'),('hero','McGinnis','mcginnis'),('hero','Mina','mina'),('hero','Mirage','mirage'),
('hero','Mo & Krill','mo-krill'),('hero','Paige','paige'),('hero','Paradox','paradox'),('hero','Pocket','pocket'),
('hero','Rem','rem'),('hero','Seven','seven'),('hero','Shiv','shiv'),('hero','Silver','silver'),
('hero','Sinclair','sinclair'),('hero','The Doorman','the-doorman'),('hero','Venator','venator'),('hero','Victor','victor'),
('hero','Vindicta','vindicta'),('hero','Viscous','viscous'),('hero','Vyper','vyper'),('hero','Warden','warden'),
('hero','Wraith','wraith'),('hero','Yamato','yamato') ON CONFLICT DO NOTHING;

CREATE TABLE video_library.video_taxonomy (
    video_id BIGINT NOT NULL REFERENCES video_library.videos(id) ON DELETE CASCADE,
    taxonomy_id BIGINT NOT NULL REFERENCES video_library.taxonomy(id) ON DELETE CASCADE,
    PRIMARY KEY (video_id, taxonomy_id)
);
CREATE TABLE video_library.free_tags (
    video_id BIGINT NOT NULL REFERENCES video_library.videos(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (video_id, tag)
);

CREATE TABLE video_library.playlists (
    id TEXT PRIMARY KEY,
    owner_discord_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    source TEXT NOT NULL CHECK (source IN ('manual', 'yt')),
    yt_playlist_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((source = 'yt') = (yt_playlist_id IS NOT NULL))
);
CREATE TABLE video_library.playlist_items (
    playlist_id TEXT NOT NULL REFERENCES video_library.playlists(id) ON DELETE CASCADE,
    video_id BIGINT NOT NULL REFERENCES video_library.videos(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (playlist_id, video_id),
    UNIQUE (playlist_id, position)
);

CREATE INDEX video_feed_idx ON video_library.videos (published_at DESC) WHERE status = 'live';
CREATE INDEX video_search_idx ON video_library.videos USING GIN
    (to_tsvector('german', title || ' ' || description));
