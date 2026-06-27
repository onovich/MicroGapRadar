import "server-only";

type NodeEnv = "development" | "production" | "test";
type SerpProviderName = "mock" | "serpapi" | "dataforseo" | "brave";

type ServerEnv = {
  appUrl: string;
  nodeEnv: NodeEnv;
  adminEmail?: string;
  adminPassword?: string;
  sessionSecret?: string;
  databaseUrl?: string;
  openaiApiKey?: string;
  openaiModel: string;
  openaiReasoningModel: string;
  serpProvider: SerpProviderName;
  serpApiKey?: string;
  dataForSeoLogin?: string;
  dataForSeoPassword?: string;
  braveSearchApiKey?: string;
  cronSecret?: string;
};

const nodeEnvs = new Set<NodeEnv>(["development", "production", "test"]);
const serpProviders = new Set<SerpProviderName>([
  "mock",
  "serpapi",
  "dataforseo",
  "brave",
]);

function readOptional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readNodeEnv(): NodeEnv {
  const value = process.env.NODE_ENV;
  return nodeEnvs.has(value as NodeEnv) ? (value as NodeEnv) : "development";
}

function readSerpProvider(): SerpProviderName {
  const value = process.env.SERP_PROVIDER?.trim().toLowerCase();
  return serpProviders.has(value as SerpProviderName)
    ? (value as SerpProviderName)
    : "mock";
}

function readUrl(name: string, fallback: string): string {
  const value = readOptional(name) ?? fallback;

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

export const env: ServerEnv = {
  appUrl: readUrl("APP_URL", "http://localhost:3000"),
  nodeEnv: readNodeEnv(),
  adminEmail: readOptional("ADMIN_EMAIL"),
  adminPassword: readOptional("ADMIN_PASSWORD"),
  sessionSecret: readOptional("SESSION_SECRET"),
  databaseUrl: readOptional("DATABASE_URL"),
  openaiApiKey: readOptional("OPENAI_API_KEY"),
  openaiModel: readOptional("OPENAI_MODEL") ?? "gpt-4.1-mini",
  openaiReasoningModel: readOptional("OPENAI_REASONING_MODEL") ?? "gpt-4.1",
  serpProvider: readSerpProvider(),
  serpApiKey: readOptional("SERP_API_KEY"),
  dataForSeoLogin: readOptional("DATAFORSEO_LOGIN"),
  dataForSeoPassword: readOptional("DATAFORSEO_PASSWORD"),
  braveSearchApiKey: readOptional("BRAVE_SEARCH_API_KEY"),
  cronSecret: readOptional("CRON_SECRET"),
};

export function getRequiredServerEnv<K extends keyof ServerEnv>(
  key: K,
): NonNullable<ServerEnv[K]> {
  const value = env[key];

  if (value === undefined || value === "") {
    throw new Error(`Missing required server environment variable: ${key}`);
  }

  return value as NonNullable<ServerEnv[K]>;
}
