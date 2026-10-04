-- Server-owned anonymous groups. Browser roles cannot read identity columns.
CREATE TABLE IF NOT EXISTS echo_groups (
 id uuid PRIMARY KEY, name varchar(60) NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 60),
 description varchar(240) NOT NULL DEFAULT '', owner_id text NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
 invite_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS echo_groups_owner_created_idx ON echo_groups(owner_id,created_at);
CREATE TABLE IF NOT EXISTS echo_group_members (
 id uuid PRIMARY KEY, group_id uuid NOT NULL REFERENCES echo_groups(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE, alias varchar(48) NOT NULL,
 removed boolean NOT NULL DEFAULT false, banned boolean NOT NULL DEFAULT false, joined_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT echo_member_group_user_unique UNIQUE(group_id,user_id)
);
CREATE INDEX IF NOT EXISTS echo_member_user_idx ON echo_group_members(user_id);
CREATE TABLE IF NOT EXISTS echo_group_messages (
 id uuid PRIMARY KEY, group_id uuid NOT NULL REFERENCES echo_groups(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES echo_group_members(id) ON DELETE CASCADE,
 content varchar(2000) NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 2000),
 hidden boolean NOT NULL DEFAULT false, created_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS echo_message_group_created_idx ON echo_group_messages(group_id,created_at,id);
CREATE INDEX IF NOT EXISTS echo_message_member_created_idx ON echo_group_messages(member_id,created_at);
CREATE TABLE IF NOT EXISTS echo_group_reports (
 id uuid PRIMARY KEY, message_id uuid NOT NULL REFERENCES echo_group_messages(id) ON DELETE CASCADE,
 reporter_id text NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE, reason varchar(200) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT echo_group_report_unique UNIQUE(message_id,reporter_id)
);
ALTER TABLE echo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE echo_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE echo_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE echo_group_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON echo_groups,echo_group_members,echo_group_messages,echo_group_reports FROM anon,authenticated;
