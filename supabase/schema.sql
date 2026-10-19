-- 匿名聊天室：Supabase 資料庫設定（對應 docs/architecture.md 第 3.2、4.1、9 節）
-- 貼到 Supabase 的 SQL Editor 執行。可以重複執行，不會出錯，也不會刪掉已有的訊息。
-- 如果你之前已經執行過舊版，再執行一次這份就會升級（更嚴的代號檢查、發送頻率限制）。

-- 1. 訊息資料表
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  nickname   text        not null,
  content    text        not null,
  created_at timestamptz not null default now()
);

-- 2. 資料庫層的內容檢查（最終防線，前端的檢查可以被繞過）
--
-- 「看不見的字元」包含：不換行空格、各種寬度的空格、零寬字元、方向控制字元、
-- 行分隔符、BOM、全形空格、韓文填充字元、盲文空白。用 chr(編號) 寫，這份檔案裡不會有看不見的字元。
-- 這是常見的一批，不是整個 Unicode；零寬連接符（編號 8205）刻意不擋，組合表情符號（家庭、膚色）要用到。

alter table public.messages drop constraint if exists messages_nickname_length;
alter table public.messages add constraint messages_nickname_length check (
  -- 長度：最多 12 個字
  char_length(nickname) <= 12
  -- 不能只有空白或看不見的字元
  and char_length(btrim(
        nickname,
        E' \t\r\n' || chr(160) || chr(173) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
        || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8203)
        || chr(8204) || chr(8205) || chr(8206) || chr(8207) || chr(8232) || chr(8233) || chr(8234)
        || chr(8235) || chr(8236) || chr(8237) || chr(8238) || chr(8239) || chr(8287) || chr(8288)
        || chr(10240) || chr(12288) || chr(12644) || chr(65279)
      )) >= 1
  -- 不能含控制字元
  and nickname !~ '[[:cntrl:]]'
  -- 不能含零寬、方向控制等看不見的字元（translate 把這些字元刪掉，沒變就表示原本沒有）
  and translate(
        nickname,
        chr(173) || chr(8203) || chr(8204) || chr(8206) || chr(8207) || chr(8232) || chr(8233)
        || chr(8234) || chr(8235) || chr(8236) || chr(8237) || chr(8238) || chr(8288) || chr(65279),
        ''
      ) = nickname
);

alter table public.messages drop constraint if exists messages_content_length;
alter table public.messages add constraint messages_content_length check (
  char_length(content) <= 500
  and char_length(btrim(
        content,
        E' \t\r\n' || chr(160) || chr(173) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
        || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8203)
        || chr(8204) || chr(8205) || chr(8206) || chr(8207) || chr(8232) || chr(8233) || chr(8234)
        || chr(8235) || chr(8236) || chr(8237) || chr(8238) || chr(8239) || chr(8287) || chr(8288)
        || chr(10240) || chr(12288) || chr(12644) || chr(65279)
      )) >= 1
);

-- 3. 發送頻率限制：同一個代號，10 秒內最多 5 則，第 6 則會被擋下（錯誤訊息含 rate_limited，
--    網頁據此顯示「送太快了，請稍等幾秒再送」）。
--    限制：只管代號。有人每次換一個代號，這個限制擋不住；同一瞬間同時送出的請求，偶爾也可能多放過一兩則。
create index if not exists messages_nickname_created_at_idx
  on public.messages (nickname, created_at desc);

create or replace function public.messages_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.messages
    where nickname = new.nickname and created_at > now() - interval '10 seconds'
  ) >= 5 then
    raise exception 'rate_limited: 每個代號 10 秒最多 5 則訊息' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.messages_rate_limit();

-- 4. 打開資料庫規則（RLS）。沒有規則允許的事，一律不能做
alter table public.messages enable row level security;

-- 5. 權限：先全部收回，再只給匿名使用者（網頁使用的 anon 角色）需要的
revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to anon;
-- 新增時只能填代號和內容；編號與時間一定由資料庫自己產生，不能偽造
grant insert (nickname, content) on table public.messages to anon;
-- 沒有 update、delete：訊息送出後不能被修改或刪除

-- 6. 規則：任何人都能讀、任何人都能新增
drop policy if exists "anyone can read messages" on public.messages;
create policy "anyone can read messages"
  on public.messages for select to anon using (true);

drop policy if exists "anyone can add messages" on public.messages;
create policy "anyone can add messages"
  on public.messages for insert to anon with check (true);

-- 7. 打開即時通知：有新訊息寫入時，Supabase 會通知所有連線中的人
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- 8. 檢查結果：執行完會顯示一列，預期是
--    policy_count = 2、rls_enabled = true、realtime_enabled = true、rate_limit_enabled = true、check_count = 2
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'messages') as policy_count,
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass) as rls_enabled,
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) as realtime_enabled,
  exists (
    select 1 from pg_trigger
    where tgname = 'messages_rate_limit' and tgrelid = 'public.messages'::regclass and not tgisinternal
  ) as rate_limit_enabled,
  (select count(*) from pg_constraint where conrelid = 'public.messages'::regclass and contype = 'c') as check_count;
