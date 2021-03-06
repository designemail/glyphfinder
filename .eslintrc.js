module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'scrumpy',
  ],
  rules: {
    // 'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-console': 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'max-len': 'off',
  },
  parserOptions: {
    parser: 'babel-eslint',
  },
}
