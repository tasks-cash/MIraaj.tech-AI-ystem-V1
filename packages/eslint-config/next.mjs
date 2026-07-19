import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default [
  ...nextVitals,
  ...nextTypeScript,
  {
    ignores: [".next/**", "out/**", "dist/**", "next-env.d.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
];
