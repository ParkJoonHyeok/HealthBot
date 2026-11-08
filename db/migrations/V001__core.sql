-- Forward-only migration. Apply once through the migration runner.
CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(254) NOT NULL CHECK (email = btrim(email) AND email LIKE '%@%'),
  password_hash varchar(60) NOT NULL CHECK (password_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'),
  display_name varchar(40) NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 40),
  role varchar(10) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','ADMIN')),
  status varchar(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','DELETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_user_email_unique ON app_user (lower(email));

CREATE TABLE hospital (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(30) NOT NULL CHECK (length(btrim(provider)) > 0),
  provider_id text NOT NULL CHECK (length(btrim(provider_id)) > 0),
  name varchar(200) NOT NULL CHECK (length(btrim(name)) > 0),
  address text NOT NULL,
  phone varchar(40),
  latitude numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
  source_checked_at timestamptz NOT NULL,
  UNIQUE(provider, provider_id),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);
CREATE INDEX hospital_name_idx ON hospital (name);

CREATE TABLE post (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES app_user(id),
  title varchar(150) NOT NULL CHECK (length(btrim(title)) > 0),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
  status varchar(10) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED','HIDDEN','DELETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_feed_idx ON post (created_at DESC, id DESC) WHERE status='PUBLISHED';
CREATE INDEX post_author_idx ON post (author_id);

CREATE TABLE comment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES post(id),
  author_id uuid NOT NULL REFERENCES app_user(id),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  status varchar(10) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED','HIDDEN','DELETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comment_post_idx ON comment (post_id, created_at, id);
CREATE INDEX comment_author_idx ON comment (author_id);

CREATE TABLE review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES hospital(id),
  author_id uuid NOT NULL REFERENCES app_user(id),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 3000),
  status varchar(10) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED','HIDDEN','DELETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hospital_id, author_id)
);
CREATE INDEX review_hospital_feed_idx ON review (hospital_id, created_at DESC, id DESC) WHERE status='PUBLISHED';
CREATE INDEX review_author_idx ON review (author_id);

CREATE TABLE report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES app_user(id),
  post_id uuid REFERENCES post(id),
  comment_id uuid REFERENCES comment(id),
  review_id uuid REFERENCES review(id),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  status varchar(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (num_nonnulls(post_id,comment_id,review_id)=1),
  CHECK ((status='OPEN') = (resolved_at IS NULL))
);
CREATE INDEX report_queue_idx ON report (created_at, id) WHERE status='OPEN';
CREATE INDEX report_reporter_idx ON report (reporter_id);
CREATE UNIQUE INDEX report_post_unique ON report (reporter_id,post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX report_comment_unique ON report (reporter_id,comment_id) WHERE comment_id IS NOT NULL;
CREATE UNIQUE INDEX report_review_unique ON report (reporter_id,review_id) WHERE review_id IS NOT NULL;
