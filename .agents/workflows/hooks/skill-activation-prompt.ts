#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

interface HookInput {
    session_id?: string;
    transcript_path?: string;
    cwd?: string;
    permission_mode?: string;
    prompt?: string;
}

interface PromptTriggers {
    keywords?: string[];
    intentPatterns?: string[];
}

interface FileTriggers {
    pathPatterns?: string[];
    pathExclusions?: string[];
    contentPatterns?: string[];
}

interface SkillRule {
    type: 'guardrail' | 'domain';
    enforcement: 'block' | 'suggest' | 'warn';
    priority: 'critical' | 'high' | 'medium' | 'low';
    promptTriggers?: PromptTriggers;
    fileTriggers?: FileTriggers;
}

interface SkillRules {
    version: string;
    skills: Record<string, SkillRule>;
}

interface MatchedSkill {
    name: string;
    config: SkillRule;
    reasons: string[];
}

interface RecentEdit {
    absolutePath: string;
    relativePath: string;
}

const PRIORITY_ORDER: Array<SkillRule['priority']> = ['critical', 'high', 'medium', 'low'];
const PRIORITY_LABEL: Record<SkillRule['priority'], string> = {
    critical: 'CRITICAL SKILLS',
    high: 'RECOMMENDED SKILLS',
    medium: 'SUGGESTED SKILLS',
    low: 'OPTIONAL SKILLS'
};

function safeParseJson<T>(raw: string): T | null {
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

function findProjectDir(input: HookInput): string {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
        process.env.GEMINI_PROJECT_DIR,
        process.env.CODEX_PROJECT_DIR,
        input.cwd,
        resolve(scriptDir, '../../..'),
        process.cwd()
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
        const normalized = resolve(candidate);
        const rulesPath = join(normalized, '.agents', 'skills', 'skill-rules.json');
        if (existsSync(rulesPath)) {
            return normalized;
        }
    }

    return resolve(scriptDir, '../../..');
}

function globToRegex(glob: string): RegExp {
    const normalized = glob.replace(/\\/g, '/');
    let out = '^';

    for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        const next = normalized[i + 1];
        const afterNext = normalized[i + 2];

        if (char === '*' && next === '*' && afterNext === '/') {
            out += '(?:.*/)?';
            i += 2;
            continue;
        }

        if (char === '*' && next === '*') {
            out += '.*';
            i += 1;
            continue;
        }

        if (char === '*') {
            out += '[^/]*';
            continue;
        }

        if (char === '?') {
            out += '[^/]';
            continue;
        }

        if ('\\^$+?.()|{}[]'.includes(char)) {
            out += `\\${char}`;
            continue;
        }

        out += char;
    }

    out += '$';
    return new RegExp(out);
}

function matchGlob(value: string, pattern: string): boolean {
    return globToRegex(pattern).test(value.replace(/\\/g, '/'));
}

function addMatch(
    map: Map<string, MatchedSkill>,
    skillName: string,
    config: SkillRule,
    reason: string
) {
    const existing = map.get(skillName);
    if (existing) {
        if (!existing.reasons.includes(reason)) {
            existing.reasons.push(reason);
        }
        return;
    }

    map.set(skillName, {
        name: skillName,
        config,
        reasons: [reason]
    });
}

function getRecentEdit(projectDir: string, sessionId?: string): RecentEdit | null {
    if (!sessionId) {
        return null;
    }

    const logPath = join(projectDir, '.agents/workflows', 'tsc-cache', sessionId, 'edited-files.log');
    if (!existsSync(logPath)) {
        return null;
    }

    const lines = readFileSync(logPath, 'utf-8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length === 0) {
        return null;
    }

    const lastLine = lines[lines.length - 1];
    const match = lastLine.match(/^\d+:(.*):([^:]+)$/);
    if (!match || match.length < 3) {
        return null;
    }

    const rawFilePath = match[1];
    const absolutePath = isAbsolute(rawFilePath) ? rawFilePath : resolve(projectDir, rawFilePath);
    const relativePath = relative(projectDir, absolutePath).replace(/\\/g, '/');

    return {
        absolutePath,
        relativePath
    };
}

function matchesFileTrigger(
    relativeFilePath: string,
    absoluteFilePath: string,
    triggers?: FileTriggers
): { path: boolean; content: boolean } {
    if (!triggers) {
        return { path: false, content: false };
    }

    const pathPatterns = triggers.pathPatterns ?? [];
    const pathExclusions = triggers.pathExclusions ?? [];
    const contentPatterns = triggers.contentPatterns ?? [];

    let pathMatched = false;

    if (pathPatterns.length > 0) {
        pathMatched = pathPatterns.some((pattern) => matchGlob(relativeFilePath, pattern));
        if (pathMatched && pathExclusions.length > 0) {
            const excluded = pathExclusions.some((pattern) => matchGlob(relativeFilePath, pattern));
            if (excluded) {
                pathMatched = false;
            }
        }
    }

    let contentMatched = false;
    if (contentPatterns.length > 0) {
        // 콘텐츠 패턴은 경로가 맞거나 경로 패턴이 없을 때만 확인해 성능을 아낍니다.
        const shouldInspectContent = pathMatched || pathPatterns.length === 0;
        if (shouldInspectContent) {
            try {
                const content = readFileSync(absoluteFilePath, 'utf-8');
                contentMatched = contentPatterns.some((pattern) => {
                    try {
                        return new RegExp(pattern, 'i').test(content);
                    } catch {
                        return false;
                    }
                });
            } catch {
                contentMatched = false;
            }
        }
    }

    return { path: pathMatched, content: contentMatched };
}

function formatOutput(matched: MatchedSkill[]): string {
    let output = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    output += 'SKILL ACTIVATION CHECK\n';
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    for (const priority of PRIORITY_ORDER) {
        const items = matched.filter((item) => item.config.priority === priority);
        if (items.length === 0) {
            continue;
        }

        output += `${PRIORITY_LABEL[priority]}:\n`;
        for (const item of items) {
            const reasonText = item.reasons.length > 0 ? ` (${item.reasons.join(', ')})` : '';
            output += `  - ${item.name}${reasonText}\n`;
        }
        output += '\n';
    }

    output += "ACTION: 필요하면 Skill 도구로 해당 스킬을 먼저 로드하세요.\n";
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    return output;
}

async function main() {
    try {
        const input = readFileSync(0, 'utf-8');
        const data = safeParseJson<HookInput>(input) ?? {};
        const prompt = (data.prompt ?? '').toLowerCase();

        const projectDir = findProjectDir(data);
        const rulesPath = join(projectDir, '.agents', 'skills', 'skill-rules.json');
        if (!existsSync(rulesPath)) {
            process.exit(0);
            return;
        }

        const rulesRaw = readFileSync(rulesPath, 'utf-8');
        const rules = safeParseJson<SkillRules>(rulesRaw);
        if (!rules?.skills) {
            process.exit(0);
            return;
        }

        const matched = new Map<string, MatchedSkill>();
        const recentEdit = getRecentEdit(projectDir, data.session_id);

        for (const [skillName, config] of Object.entries(rules.skills)) {
            const promptTriggers = config.promptTriggers;
            if (promptTriggers && prompt.length > 0) {
                if (promptTriggers.keywords?.some((kw) => prompt.includes(kw.toLowerCase()))) {
                    addMatch(matched, skillName, config, 'prompt:keyword');
                }

                if (promptTriggers.intentPatterns?.length) {
                    const intentMatched = promptTriggers.intentPatterns.some((pattern) => {
                        try {
                            return new RegExp(pattern, 'i').test(prompt);
                        } catch {
                            return false;
                        }
                    });
                    if (intentMatched) {
                        addMatch(matched, skillName, config, 'prompt:intent');
                    }
                }
            }

            if (recentEdit && config.fileTriggers) {
                const result = matchesFileTrigger(
                    recentEdit.relativePath,
                    recentEdit.absolutePath,
                    config.fileTriggers
                );
                if (result.path) {
                    addMatch(matched, skillName, config, 'file:path');
                }

                if (result.content) {
                    addMatch(matched, skillName, config, 'file:content');
                }
            }
        }

        if (matched.size === 0) {
            process.exit(0);
            return;
        }

        const ordered = Array.from(matched.values()).sort((a, b) => {
            const aPriority = PRIORITY_ORDER.indexOf(a.config.priority);
            const bPriority = PRIORITY_ORDER.indexOf(b.config.priority);
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return a.name.localeCompare(b.name);
        });

        console.log(formatOutput(ordered));
        process.exit(0);
    } catch {
        // 훅 실패로 사용자 워크플로를 막지 않도록 항상 조용히 종료합니다.
        process.exit(0);
    }
}

main().catch(() => {
    process.exit(0);
});
