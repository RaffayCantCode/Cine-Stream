interface ImportMeta {
  readonly env: {
    readonly BASE_URL: string;
    readonly MODE: string;
    readonly DEV: boolean;
    readonly PROD: boolean;
    [key: string]: string | boolean | undefined;
  };
}
