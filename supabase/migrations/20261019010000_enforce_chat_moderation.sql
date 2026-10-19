-- Turn on server-side chat moderation (functions from
-- 20261019000000_security_hardening.sql). Apply only after the web app that
-- sends chat-moderate's token is live, or older clients can't send messages.

drop trigger if exists trg_enforce_chat_moderation on public.messages;
create trigger trg_enforce_chat_moderation
  before insert or update on public.messages
  for each row execute function public.enforce_chat_moderation();

drop trigger if exists trg_enforce_chat_moderation on public.scheduled_chat_messages;
create trigger trg_enforce_chat_moderation
  before insert or update of content, is_flagged, moderation_token on public.scheduled_chat_messages
  for each row execute function public.enforce_chat_moderation();

