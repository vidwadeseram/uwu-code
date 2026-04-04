import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    rules: {
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
    },
    ignores: [
      ".next/**",
      "node_modules/**",
    ],
  },
];

export default config;
