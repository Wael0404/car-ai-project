// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Guards against HTML entity mistakes on the web; React Native <Text>
      // renders apostrophes as-is, and French copy is full of them.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
