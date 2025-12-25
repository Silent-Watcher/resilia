import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/*'],
	format: ['esm'], // Keep ESM format
	outDir: 'dist',
	clean: true,
	sourcemap: false,
	splitting: false,
	bundle: true,
	dts: true,
	minify: true,
	external: ['pino'],
	loader: {
		'.json': 'json', // ⬅ transforms JSON into normal ESM object
	},
	outExtension: () => ({ js: '.js' }), // Force .js instead of .mjs
});
