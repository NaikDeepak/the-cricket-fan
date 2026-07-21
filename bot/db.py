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
    sa.Column("post_type", sa.String(16), nullable=False),
    # 'prediction' | 'trivia' | 'result' | 'standalone_trivia'
    sa.Column("state", sa.String(16), nullable=False, default="scheduled"),
    # 'scheduled' | 'posted' | 'failed' | 'abandoned'
    sa.Column("attempts", sa.Integer, nullable=False, default=0),
    sa.Column("text", sa.Text, nullable=True),
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
