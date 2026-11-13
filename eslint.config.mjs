export default [{
  files: ["**/*.js", "**/*.mjs"],
  languageOptions: {
    ecmaVersion: "latest", sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  rules: {
    "no-dupe-keys": "error", "no-unreachable": "error",
    "no-duplicate-imports": "error", "constructor-super": "error",
  },
}];
