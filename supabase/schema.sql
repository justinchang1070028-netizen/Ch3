-- 匿名聊天室：Supabase 資料庫設定（對應 docs/architecture.md 第 3.2、4.1、9 節）
-- 貼到 Supabase 的 SQL Editor 執行。可以重複執行，不會出錯，也不會刪掉已有的訊息。

-- 1. 訊息資料表
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  nickname   text        not null,
  content    text        not null,
  created_at timestamptz not null default now(),

  -- 資料庫層的長度限制（最終防線，前端的檢查可以被繞過）
  constraint messages_nickname_length check (
    char_length(nickname) <= 12 and char_length(btrim(nickname, E' \t\r\n')) >= 1
  ),
  constraint messages_content_length check (
    char_length(content) <= 500 and char_length(btrim(content, E' \t\r\n')) >= 1
  )
);

-- 2. 打開資料庫規則（RLS）。沒有規則允許的事，一律不能做
alter table public.messages enable row level security;

-- 3. 權限：先全部收回，再只給匿名使用者（網頁使用的 anon 角色）需要的
revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to anon;
-- 新增時只能填代號和內容；編號與時間一定由資料庫自己產生，不能偽造
grant insert (nickname, content) on table public.messages to anon;
-- 沒有 update、delete：訊息送出後不能被修改或刪除

-- 4. 規則：任何人都能讀、任何人都能新增
drop policy if exists "anyone can read messages" on public.messages;
create policy "anyone can read messages"
  on public.messages for select to anon using (true);

drop policy if exists "anyone can add messages" on public.messages;
create policy "anyone can add messages"
  on public.messages for insert to anon with check (true);

-- 5. 打開即時通知：有新訊息寫入時，Supabase 會通知所有連線中的人
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- 6. 檢查結果：執行完會顯示一列，預期是 policy_count = 2、rls_enabled = true、realtime_enabled = true
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'messages') as policy_count,
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass) as rls_enabled,
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) as realtime_enabled;
