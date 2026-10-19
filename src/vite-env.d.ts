/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase 專案網址（可公開） */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase 的 Publishable key（可公開）。絕對不要放 secret key 或 service_role */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
