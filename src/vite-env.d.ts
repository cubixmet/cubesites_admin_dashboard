/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_BUILD_NUMBER: string;
  readonly VITE_BUILT_AT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
