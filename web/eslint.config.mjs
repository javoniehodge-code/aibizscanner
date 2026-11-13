import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ["src/report/generated/**", "public/**", ".next/**", "node_modules/**", "next-env.d.ts", "coverage/**", "playwright-report/**", "test-results/**"],
  },
  {
    // The report engine (stage registry + stage functions) must stay independent of the worker/HTTP layer,
    // Next.js and Supabase, so execution can move to another host later.
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/worker", "@/worker/*", "**/worker/*"], message: "The engine must not import the worker layer." },
            { group: ["@/app", "@/app/*", "next", "next/*"], message: "The engine must not import Next.js or route code." },
            { group: ["@/lib/*", "@supabase/*"], message: "The engine talks to storage only through the RunStore port." },
          ],
        },
      ],
    },
  },
];

export default config;
