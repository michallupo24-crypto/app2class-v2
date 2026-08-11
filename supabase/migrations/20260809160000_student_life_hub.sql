-- Student Life Hub: student council elections, digital school newspaper,
-- and bell-song voting (students submit YouTube links, vote for their favorite).

-- ── Student Council ──────────────────────────────────────────────────────
CREATE TABLE public.council_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  position TEXT NOT NULL DEFAULT 'חבר/ת מועצה',
  term_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.council_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view council members" ON public.council_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management can manage council members" ON public.council_members
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'))
  WITH CHECK (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'));

CREATE TABLE public.council_elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  num_seats SMALLINT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'nominations' CHECK (status IN ('nominations', 'voting', 'closed')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.council_elections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view elections" ON public.council_elections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management can manage elections" ON public.council_elections
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'))
  WITH CHECK (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'));

CREATE TRIGGER update_council_elections_updated_at
  BEFORE UPDATE ON public.council_elections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.council_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.council_elections(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  statement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(election_id, student_id)
);
ALTER TABLE public.council_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view candidates" ON public.council_candidates
  FOR SELECT TO authenticated USING (true);
-- Students self-nominate only while the election is still accepting nominations.
CREATE POLICY "Students can self-nominate during nominations" ON public.council_candidates
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.council_elections e WHERE e.id = election_id AND e.status = 'nominations')
  );
CREATE POLICY "Students can withdraw own candidacy" ON public.council_candidates
  FOR DELETE TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Management can manage candidates" ON public.council_candidates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'))
  WITH CHECK (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'));

CREATE TABLE public.council_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.council_elections(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.council_candidates(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(election_id, voter_id)
);
ALTER TABLE public.council_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can vote once while voting is open" ON public.council_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    voter_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.council_elections e WHERE e.id = election_id AND e.status = 'voting')
  );
CREATE POLICY "Users can view own vote" ON public.council_votes
  FOR SELECT TO authenticated USING (voter_id = auth.uid());
-- Aggregate vote counts are readable by everyone once an election is closed.
CREATE POLICY "Everyone can view votes on closed elections" ON public.council_votes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.council_elections e WHERE e.id = election_id AND e.status = 'closed'));
CREATE POLICY "Management can view all votes" ON public.council_votes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'));

-- ── Digital School Newspaper ─────────────────────────────────────────────
CREATE TABLE public.newspaper_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  category TEXT NOT NULL DEFAULT 'news' CHECK (category IN ('news', 'sports', 'culture', 'opinion', 'council')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'rejected')),
  likes INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.newspaper_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view published articles" ON public.newspaper_articles
  FOR SELECT TO authenticated USING (status = 'published');
CREATE POLICY "Authors can view own drafts" ON public.newspaper_articles
  FOR SELECT TO authenticated USING (author_id = auth.uid());
CREATE POLICY "Staff can view all articles for review" ON public.newspaper_articles
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'educator') OR has_role(auth.uid(), 'management') OR
    has_role(auth.uid(), 'system_admin') OR has_role(auth.uid(), 'counselor')
  );
CREATE POLICY "Authenticated can submit article drafts" ON public.newspaper_articles
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND status = 'draft');
CREATE POLICY "Authors can edit own drafts" ON public.newspaper_articles
  FOR UPDATE TO authenticated USING (author_id = auth.uid() AND status = 'draft');
CREATE POLICY "Staff can review and publish articles" ON public.newspaper_articles
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'educator') OR has_role(auth.uid(), 'management') OR
    has_role(auth.uid(), 'system_admin') OR has_role(auth.uid(), 'counselor')
  );

CREATE TRIGGER update_newspaper_articles_updated_at
  BEFORE UPDATE ON public.newspaper_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.newspaper_article_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.newspaper_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(article_id, user_id)
);
ALTER TABLE public.newspaper_article_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view likes" ON public.newspaper_article_likes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like articles" ON public.newspaper_article_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can unlike own likes" ON public.newspaper_article_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── Bell Song Voting ──────────────────────────────────────────────────────
CREATE TABLE public.bell_song_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  suggested_by UUID NOT NULL,
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bell_song_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view song suggestions" ON public.bell_song_suggestions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can suggest songs" ON public.bell_song_suggestions
  FOR INSERT TO authenticated WITH CHECK (suggested_by = auth.uid());
CREATE POLICY "Suggesters can remove own songs" ON public.bell_song_suggestions
  FOR DELETE TO authenticated USING (suggested_by = auth.uid());
CREATE POLICY "Management can manage song suggestions" ON public.bell_song_suggestions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'))
  WITH CHECK (has_role(auth.uid(), 'management') OR has_role(auth.uid(), 'system_admin'));

-- One active vote per student at a time - voting for a new song moves your vote (upsert on voter_id).
CREATE TABLE public.bell_song_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES public.bell_song_suggestions(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bell_song_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view song votes" ON public.bell_song_votes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own song vote" ON public.bell_song_votes
  FOR ALL TO authenticated USING (voter_id = auth.uid()) WITH CHECK (voter_id = auth.uid());

CREATE INDEX idx_council_candidates_election ON public.council_candidates(election_id);
CREATE INDEX idx_council_votes_election ON public.council_votes(election_id);
CREATE INDEX idx_newspaper_articles_school_status ON public.newspaper_articles(school_id, status);
CREATE INDEX idx_bell_song_votes_suggestion ON public.bell_song_votes(suggestion_id);
