export type State = "idle" | "loading" | "upToDate" | "updateAvailable";

export type UpdateCheckResult = {
  available: boolean;
  version: string;
  current: string;
};