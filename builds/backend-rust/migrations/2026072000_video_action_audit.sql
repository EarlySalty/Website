CREATE TABLE video_library.action_audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_discord_id TEXT NOT NULL,
    action TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    detail JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX action_audit_object_idx
    ON video_library.action_audit_log (object_type, object_id, created_at DESC);
