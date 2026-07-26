import { defineConfig } from 'vitest/config';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [
        viteTsConfigPaths({
            projects: ['./tsconfig.json'],
        }),
        viteReact(),
    ],
    test: {
        env: {
            VITE_ENV: 'development',
        },
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        server: {
            deps: {
                inline: ['@tanstack/react-router', '@tanstack/router-core', '@tanstack/history', 'tiny-warning', 'tiny-invariant'],
            },
        },
    },
});
