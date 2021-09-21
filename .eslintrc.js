module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true
  },
  extends: ['airbnb-base/legacy', 'plugin:vue/recommended'],
  parserOptions: {
    parser: 'babel-eslint',
    ecmaFeatures: {
      jsx: true
    },
    sourceType: 'module'
  },
  plugins: [],
  parser: 'vue-eslint-parser',
  rules: {
    'no-console': 0,
    'import/no-unresolved': 0,
    'global-require': 0,
    'linebreak-style': ['error', 'windows'],
    'max-len': ['error', { code: 150 }],
    'no-param-reassign': ['error', { props: false }],
    'no-script-url': 0
  }
};
