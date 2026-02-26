import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
	{
		ignores: ['dist/**', 'node_modules/**', 'gulpfile.js'],
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: './tsconfig.json',
				sourceType: 'module',
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-non-null-assertion': 'error',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
			'@typescript-eslint/no-unnecessary-type-assertion': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/prefer-optional-chain': 'error',
			'no-console': 'error',
			'prefer-const': 'error',
			'eqeqeq': ['error', 'always'],
		},
	},
	...compat.extends('plugin:n8n-nodes-base/community'),

	// nodes profile — validates node parameter conventions
	{
		files: ['nodes/**/*.ts'],
		...compat.extends('plugin:n8n-nodes-base/nodes')[0],
	},

	// credentials profile — validates credential parameter conventions
	{
		files: ['credentials/**/*.ts'],
		...compat.extends('plugin:n8n-nodes-base/credentials')[0],
	},
];
