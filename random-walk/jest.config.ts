import type { Config } from "jest";

/** Jest configuration for Next.js with TypeScript. */
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
};

export default config;
