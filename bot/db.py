import sqlalchemy as sa

metadata = sa.MetaData()

# Aggregate feature store: two rows per completed match (one per team perspective).
team_matches = sa.Table(
    "team_matches",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("team", sa.String(64), nullable=False, index=True),
    sa.Column("opponent", sa.String(64), nullable=False),
    sa.Column("date", sa.Date, nullable=False, index=True),
    sa.Column("season", sa.String(16), nullable=False),
    sa.Column("league", sa.String(32), nullable=False),
    sa.Column("venue", sa.String(128), nullable=False),
    sa.Column("won", sa.Boolean, nullable=False),
    sa.Column("dls", sa.Boolean, nullable=False, default=False),
    sa.Column("runs_scored", sa.Float, nullable=True),
    sa.Column("overs_faced", sa.Float, nullable=True),
    sa.Column("runs_conceded", sa.Float, nullable=True),
    sa.Column("overs_bowled", sa.Float, nullable=True),
    sa.Column("home", sa.Boolean, nullable=False, default=False),
    sa.Column("batted_first", sa.Boolean, nullable=False, default=False),
    sa.Column("pp_runs_scored", sa.Float, nullable=True),
    sa.Column("pp_overs_faced", sa.Float, nullable=True),
    sa.Column("death_runs_conceded", sa.Float, nullable=True),
    sa.Column("death_overs_bowled", sa.Float, nullable=True),
)

aliases = sa.Table(
    "aliases",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("kind", sa.String(8), nullable=False),  # 'team' | 'venue'
    sa.Column("alias", sa.String(128), nullable=False),
    sa.Column("canonical", sa.String(128), nullable=False),
    sa.UniqueConstraint("kind", "alias", name="uq_alias"),
)

fixtures = sa.Table(
    "fixtures",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("provider_match_id", sa.String(64), nullable=False, unique=True),
    sa.Column("team_a", sa.String(64), nullable=False),  # canonical
    sa.Column("team_b", sa.String(64), nullable=False),  # canonical
    sa.Column("venue", sa.String(128), nullable=False),  # canonical
    sa.Column("league", sa.String(32), nullable=False),
    sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
    sa.Column("status", sa.String(16), nullable=False, default="upcoming"),
    # 'upcoming' | 'completed' | 'void'
    sa.Column("winner", sa.String(64), nullable=True),
)

predictions = sa.Table(
    "predictions",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column(
        "fixture_id",
        sa.Integer,
        sa.ForeignKey("fixtures.id"),
        nullable=False,
        unique=True,
    ),
    sa.Column("prob_team_a", sa.Float, nullable=False),
    sa.Column("reasons_json", sa.Text, nullable=False),  # json list[str]
    sa.Column("features_json", sa.Text, nullable=False),  # json dict snapshot
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("outcome", sa.String(16), nullable=False, default="pending"),
    # 'pending' | 'correct' | 'incorrect' | 'void'
)

posts = sa.Table(
    "posts",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("fixture_id", sa.Integer, nullable=True),
    sa.Column("post_type", sa.String(20), nullable=False),
    # 'prediction' | 'trivia' | 'result' | 'standalone_trivia'
    sa.Column("state", sa.String(16), nullable=False, default="scheduled"),
    # 'scheduled' | 'posted' | 'partial' | 'failed' | 'abandoned'
    sa.Column("attempts", sa.Integer, nullable=False, default=0),
    sa.Column("text", sa.Text, nullable=True),
    sa.Column("tweet_count", sa.Integer, nullable=False, server_default=sa.text("1")),
    sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("slot_key", sa.String(32), nullable=True, unique=True),
    sa.UniqueConstraint("fixture_id", "post_type", name="uq_post"),
)


trivia_log = sa.Table(
    "trivia_log",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("content_key", sa.String(128), nullable=False, index=True),
    sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False, index=True),
)

content_bank = sa.Table(
    "content_bank",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("category", sa.String(16), nullable=False),
    # 'wiki_record' | 'anecdote' | 'story'
    sa.Column("format", sa.String(8), nullable=False),
    # 'single' | 'thread'
    sa.Column("segments_json", sa.Text, nullable=False),
    # JSON list[str]; len == 1 for 'single', 2-4 for 'thread'
    sa.Column("content_key", sa.String(128), nullable=False, unique=True),
    sa.Column("source", sa.String(256), nullable=False),
    # e.g. "wikipedia:List_of_Test_cricket_records" -- traceability, not shown
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("event_month_day", sa.String(5), nullable=True),
    # "MM-DD" the item's anniversary falls on, e.g. "07-24"; null if undated
)

drafts = sa.Table(
    "drafts",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("source", sa.String(16), nullable=False),
    # 'bank' | 'bot' | 'llm' | 'freeform'
    sa.Column("category", sa.String(24), nullable=True),
    sa.Column("text", sa.Text, nullable=False),
    sa.Column("card_type", sa.String(16), nullable=True),
    # 'prediction' | 'trivia' | 'record' | null
    sa.Column("card_meta_json", sa.Text, nullable=True),
    sa.Column("status", sa.String(12), nullable=False, default="draft"),
    # 'draft' | 'posted'
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("content_key", sa.String(128), nullable=True),
    # set only when source == 'bank'; links back to content_bank.content_key
    # so the composer can avoid resurfacing already-used bank items
)

content_events = sa.Table(
    "content_events",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column(
        "draft_id",
        sa.Integer,
        sa.ForeignKey("drafts.id", ondelete="CASCADE"),
        nullable=False,
    ),
    sa.Column("action", sa.String(12), nullable=False),
    # 'generated' | 'edited' | 'copied' | 'posted'
    sa.Column("platform_hint", sa.String(16), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
)


def get_engine(url: str) -> sa.Engine:
    return sa.create_engine(url, pool_pre_ping=True)


def ensure_schema(conn: sa.Connection) -> None:
    """Idempotent, safe to call every tick. New tables (e.g. trivia_log) are
    created via create_all on any dialect. The already-existing `posts`
    table on the live Neon DB needs explicit migration DDL to pick up
    `slot_key` and the relaxed `fixture_id` constraint -- create_all() does
    not alter existing tables. That DDL is Postgres-only syntax
    (ALTER COLUMN ... DROP NOT NULL doesn't exist in SQLite), so it's
    guarded by dialect: the test suite's sqlite engine must skip it.
    """
    metadata.create_all(conn)
    if conn.dialect.name == "postgresql":
        conn.execute(
            sa.text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS slot_key VARCHAR(32)")
        )
        conn.execute(sa.text("ALTER TABLE posts ALTER COLUMN fixture_id DROP NOT NULL"))
        conn.execute(
            sa.text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_posts_slot_key ON posts(slot_key)"
            )
        )
        conn.execute(
            sa.text("ALTER TABLE posts ALTER COLUMN post_type TYPE VARCHAR(20)")
        )
        conn.execute(
            sa.text(
                "ALTER TABLE posts ADD COLUMN IF NOT EXISTS "
                "tweet_count INTEGER NOT NULL DEFAULT 1"
            )
        )
    # Plain ADD COLUMN (no "IF NOT EXISTS" -- SQLite's ALTER TABLE grammar
    # doesn't support that clause, unlike Postgres) is valid on both
    # dialects, so these aren't dialect-guarded. They must also patch
    # pre-existing local dev SQLite files, which create_all() won't touch.
    inspector = sa.inspect(conn)
    draft_cols = {c["name"] for c in inspector.get_columns("drafts")}
    if "content_key" not in draft_cols:
        conn.execute(sa.text("ALTER TABLE drafts ADD COLUMN content_key VARCHAR(128)"))
    bank_cols = {c["name"] for c in inspector.get_columns("content_bank")}
    if "event_month_day" not in bank_cols:
        conn.execute(
            sa.text("ALTER TABLE content_bank ADD COLUMN event_month_day VARCHAR(5)")
        )
