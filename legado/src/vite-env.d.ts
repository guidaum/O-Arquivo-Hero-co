/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_EMAIL_PASSWORD_AUTH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
