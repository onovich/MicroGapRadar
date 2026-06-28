import { MockSerpProvider } from "./mock-provider";
import type { SerpProvider } from "./types";

export {
  MOCK_SERP_DEFAULT_LIMIT,
  MOCK_SERP_MAX_LIMIT,
  MockSerpProvider,
} from "./mock-provider";
export type {
  SerpProvider,
  SerpResult,
  SerpResultType,
  SerpSearchInput,
} from "./types";
export { SERP_RESULT_TYPES } from "./types";

export const SERP_PROVIDER_NAMES = ["mock"] as const;

export type SerpProviderName = (typeof SERP_PROVIDER_NAMES)[number];

export function createSerpProvider(name: SerpProviderName | string = "mock"): SerpProvider {
  const providerName = name.trim().toLowerCase();

  if (providerName === "mock") {
    return new MockSerpProvider();
  }

  throw new Error(
    `Unsupported SERP provider "${name}". Supported providers: ${SERP_PROVIDER_NAMES.join(", ")}.`,
  );
}

export function listSerpProviders(): SerpProviderName[] {
  return [...SERP_PROVIDER_NAMES];
}
