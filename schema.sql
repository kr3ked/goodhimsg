create table profiles(id uuid primary key references auth.users on delete cascade, username text unique not null, display_name text not null, bio text default '', show_online boolean default true);
create table chats(id uuid primary key default gen_random_uuid(), type text not null default 'DIRECT', title text, created_at timestamptz default now());
create table chat_members(chat_id uuid references chats on delete cascade, user_id uuid references profiles on delete cascade, last_read_at timestamptz default 'epoch', primary key(chat_id,user_id));
create table messages(id uuid primary key default gen_random_uuid(), chat_id uuid not null references chats on delete cascade, sender_id uuid not null default auth.uid() references profiles, text text, reply_to uuid references messages on delete set null, created_at timestamptz default now(), edited_at timestamptz, deleted boolean default false);
create index on messages(chat_id, created_at);

create function is_member(c uuid) returns boolean language sql security definer stable set search_path=public as $$ select exists(select 1 from chat_members where chat_id=c and user_id=auth.uid()) $$;

create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,username,display_name) values(new.id, lower(new.raw_user_meta_data->>'username'), coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create function open_direct(other uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  select c.id into cid from chats c join chat_members a on a.chat_id=c.id and a.user_id=auth.uid() join chat_members b on b.chat_id=c.id and b.user_id=other where c.type='DIRECT' limit 1;
  if cid is null then
    insert into chats(type) values('DIRECT') returning id into cid;
    insert into chat_members(chat_id,user_id) values(cid,auth.uid()),(cid,other);
  end if;
  return cid;
end $$;

create function my_chats() returns table(chat_id uuid, other_id uuid, name text, username text, last_text text, last_at timestamptz, unread bigint)
language sql security definer stable set search_path=public as $$
  select c.id, p.id, p.display_name, p.username,
    (select case when m.deleted then 'Сообщение удалено' else m.text end from messages m where m.chat_id=c.id order by m.created_at desc limit 1),
    coalesce((select max(m.created_at) from messages m where m.chat_id=c.id), c.created_at),
    (select count(*) from messages m where m.chat_id=c.id and m.sender_id<>auth.uid() and not m.deleted and m.created_at>me.last_read_at)
  from chat_members me join chats c on c.id=me.chat_id
  join chat_members o on o.chat_id=c.id and o.user_id<>auth.uid()
  join profiles p on p.id=o.user_id
  where me.user_id=auth.uid() order by 6 desc $$;

alter table profiles enable row level security;
alter table chats enable row level security;
alter table chat_members enable row level security;
alter table messages enable row level security;
create policy "profiles read" on profiles for select to authenticated using (true);
create policy "profiles update own" on profiles for update to authenticated using (id=auth.uid());
create policy "chats read" on chats for select to authenticated using (is_member(id));
create policy "members read" on chat_members for select to authenticated using (is_member(chat_id));
create policy "members update own" on chat_members for update to authenticated using (user_id=auth.uid());
create policy "messages read" on messages for select to authenticated using (is_member(chat_id));
create policy "messages insert" on messages for insert to authenticated with check (sender_id=auth.uid() and is_member(chat_id));
create policy "messages update own" on messages for update to authenticated using (sender_id=auth.uid());

alter publication supabase_realtime add table messages, chat_members;
