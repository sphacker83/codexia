#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface HookInput {
    session_id?: string;
}

interface EditedFile {
    timestamp: string;
    path: string;
}

function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

function resolvePath(filePath: string, projectDir: string): string {
    if (filePath.startsWith('/')) {
        return filePath;
    }
    return join(projectDir, filePath);
}

function getFileCategory(filePath: string): 'backend' | 'frontend' | 'database' | 'other' {
    const normalized = normalizePath(filePath);

    // Backend detection first so app/api/* is treated as backend, not frontend.
    if (normalized.includes('/app/api/') ||
        normalized.includes('/api/') ||
        normalized.includes('/server/') ||
        normalized.includes('/backend/') ||
        normalized.includes('/src/api/') ||
        normalized.includes('/src/controllers/') ||
        normalized.includes('/src/services/') ||
        normalized.includes('/src/routes/')) {
        return 'backend';
    }

    if (normalized.includes('/app/') ||
        normalized.includes('/components/') ||
        normalized.includes('/lib/') ||
        normalized.includes('/frontend/') ||
        normalized.includes('/client/') ||
        normalized.includes('/src/components/') ||
        normalized.includes('/src/features/')) {
        return 'frontend';
    }

    if (normalized.includes('/database/') ||
        normalized.includes('/prisma/') ||
        normalized.includes('/migrations/')) {
        return 'database';
    }

    return 'other';
}

function shouldCheckErrorHandling(filePath: string): boolean {
    const normalized = normalizePath(filePath);

    if (normalized.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) return false;
    if (normalized.match(/\.(config|d)\.(ts|tsx|js|jsx)$/)) return false;
    if (normalized.includes('/types/')) return false;
    if (normalized.endsWith('.styles.ts')) return false;

    return normalized.match(/\.(ts|tsx|js|jsx)$/) !== null;
}

function analyzeFileContent(filePath: string): {
    hasTryCatch: boolean;
    hasAsync: boolean;
    hasPrisma: boolean;
    hasController: boolean;
    hasApiCall: boolean;
} {
    if (!existsSync(filePath)) {
        return {
            hasTryCatch: false,
            hasAsync: false,
            hasPrisma: false,
            hasController: false,
            hasApiCall: false,
        };
    }

    const content = readFileSync(filePath, 'utf-8');

    return {
        hasTryCatch: /try\s*\{/.test(content),
        hasAsync: /async\s+/.test(content),
        hasPrisma: /prisma\.|PrismaService|findMany|findUnique|create\(|update\(|delete\(/i.test(content),
        hasController: /export class.*Controller|router\.|app\.(get|post|put|delete|patch)|export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/.test(content),
        hasApiCall: /fetch\(|axios\.|apiClient\./i.test(content),
    };
}

function parseEditedFiles(trackingContent: string): EditedFile[] {
    return trackingContent
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => {
            // Current tracker format: timestamp:path:repo
            const currentFormat = line.match(/^([^:]+):(.+):([^:]+)$/);
            if (currentFormat) {
                return { timestamp: currentFormat[1], path: currentFormat[2] };
            }

            // Backward compatible format: timestamp<TAB>tool<TAB>path
            const legacy = line.split('\t');
            if (legacy.length >= 3) {
                return { timestamp: legacy[0], path: legacy[2] };
            }

            return null;
        })
        .filter((item): item is EditedFile => item !== null);
}

async function main() {
    try {
        const input = readFileSync(0, 'utf-8');
        const data: HookInput = JSON.parse(input);

        const sessionId = data.session_id || 'default';
        const projectDir = process.env.GEMINI_PROJECT_DIR || process.env.CODEX_PROJECT_DIR || process.cwd();

        const cacheDir = join(projectDir, '.agents/workflows', 'tsc-cache', sessionId);
        const trackingFile = join(cacheDir, 'edited-files.log');

        if (!existsSync(trackingFile)) {
            process.exit(0);
        }

        const trackingContent = readFileSync(trackingFile, 'utf-8');
        const editedFiles = parseEditedFiles(trackingContent);

        if (editedFiles.length === 0) {
            process.exit(0);
        }

        const categories = {
            backend: new Set<string>(),
            frontend: new Set<string>(),
            database: new Set<string>(),
            other: new Set<string>(),
        };

        const analysisResults: Array<{
            path: string;
            category: 'backend' | 'frontend' | 'database' | 'other';
            analysis: ReturnType<typeof analyzeFileContent>;
        }> = [];

        for (const file of editedFiles) {
            if (!shouldCheckErrorHandling(file.path)) continue;

            const resolvedPath = resolvePath(file.path, projectDir);
            const category = getFileCategory(resolvedPath);

            categories[category].add(file.path);

            const analysis = analyzeFileContent(resolvedPath);
            analysisResults.push({ path: file.path, category, analysis });
        }

        const needsAttention = analysisResults.some(
            ({ analysis }) =>
                analysis.hasTryCatch ||
                analysis.hasAsync ||
                analysis.hasPrisma ||
                analysis.hasController ||
                analysis.hasApiCall
        );

        if (!needsAttention) {
            process.exit(0);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 ERROR HANDLING SELF-CHECK');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        if (categories.backend.size > 0) {
            const backendFiles = analysisResults.filter(f => f.category === 'backend');
            const hasTryCatch = backendFiles.some(f => f.analysis.hasTryCatch);
            const hasPrisma = backendFiles.some(f => f.analysis.hasPrisma);
            const hasController = backendFiles.some(f => f.analysis.hasController);

            console.log('⚠️  Backend Changes Detected');
            console.log(`   ${categories.backend.size} file(s) edited\n`);

            if (hasTryCatch) {
                console.log('   ❓ Did you add Sentry.captureException() in catch blocks?');
            }
            if (hasPrisma) {
                console.log('   ❓ Are Prisma operations wrapped in error handling?');
            }
            if (hasController) {
                console.log('   ❓ Do controllers use consistent error helpers?');
            }

            console.log('\n   💡 Backend Best Practice:');
            console.log('      - All errors should be captured to Sentry');
            console.log('      - Use contextual error helpers for diagnostics');
            console.log('      - Keep route/controller error responses consistent\n');
        }

        if (categories.frontend.size > 0) {
            const frontendFiles = analysisResults.filter(f => f.category === 'frontend');
            const hasApiCall = frontendFiles.some(f => f.analysis.hasApiCall);
            const hasTryCatch = frontendFiles.some(f => f.analysis.hasTryCatch);

            console.log('💡 Frontend Changes Detected');
            console.log(`   ${categories.frontend.size} file(s) edited\n`);

            if (hasApiCall) {
                console.log('   ❓ Do API calls show user-friendly error messages?');
            }
            if (hasTryCatch) {
                console.log('   ❓ Are errors surfaced to users appropriately?');
            }

            console.log('\n   💡 Frontend Best Practice:');
            console.log('      - Use notification UI for actionable feedback');
            console.log('      - Keep error boundaries around risky components');
            console.log('      - Avoid silent failures in async handlers\n');
        }

        if (categories.database.size > 0) {
            console.log('🗄️  Database Changes Detected');
            console.log(`   ${categories.database.size} file(s) edited\n`);
            console.log('   ❓ Did you verify schema/column names?');
            console.log('   ❓ Are migrations validated locally?\n');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💡 TIP: Disable with SKIP_ERROR_REMINDER=1');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        process.exit(0);
    } catch {
        process.exit(0);
    }
}

main().catch(() => process.exit(0));
