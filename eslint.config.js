const { FlatCompat } = require('@eslint/eslintrc')

const compat = new FlatCompat({ baseDirectory: __dirname })

module.exports = [
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'node_modules/**',
      'next-env.d.ts',
      'src/generated/**',
      'data/**',
      'desktop/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Existing debt is tracked separately; new rule categories can be enabled as it is retired.
    rules: {
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react/no-unescaped-entities': 'off',
    },
    linterOptions: { reportUnusedDisableDirectives: false },
  },
]
