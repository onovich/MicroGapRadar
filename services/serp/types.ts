export const SERP_RESULT_TYPES = [
  "organic",
  "ad",
  "forum",
  "pdf",
  "video",
  "unknown",
] as const;

export type SerpResultType = (typeof SERP_RESULT_TYPES)[number];

export type SerpSearchInput = {
  keyword: string;
  country?: string;
  language?: string;
  limit?: number;
};

export type SerpResult = {
  position: number;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
  resultType?: SerpResultType;
};

export interface SerpProvider {
  search(input: SerpSearchInput): Promise<SerpResult[]>;
}
