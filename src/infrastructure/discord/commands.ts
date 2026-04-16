import {
  SUPPORTED_MODELS,
  getModelLabel,
  type SupportedModel,
} from "@/src/core/agent/models";
import {
  SUPPORTED_REASONING_EFFORTS,
  type SupportedReasoningEffort,
} from "@/src/core/agent/reasoning";

export const DISCORD_COMMAND_OPTION_TYPE = {
  STRING: 3,
  INTEGER: 4,
  ATTACHMENT: 11,
} as const;

export interface DiscordApplicationCommandOptionChoice {
  name: string;
  value: string | number;
}

export interface DiscordApplicationCommandOption {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: DiscordApplicationCommandOptionChoice[];
  min_value?: number;
  max_value?: number;
}

export interface DiscordApplicationCommandDefinition {
  name: string;
  description: string;
  options?: DiscordApplicationCommandOption[];
}

function toModelChoice(model: SupportedModel): DiscordApplicationCommandOptionChoice {
  return {
    name: getModelLabel(model),
    value: model,
  };
}

function toReasoningChoice(value: SupportedReasoningEffort): DiscordApplicationCommandOptionChoice {
  return {
    name: value,
    value,
  };
}

export const DISCORD_COMMAND_DEFINITIONS: readonly DiscordApplicationCommandDefinition[] = [
  {
    name: "run",
    description: "Codex 작업을 실행합니다.",
    options: [
      {
        type: DISCORD_COMMAND_OPTION_TYPE.STRING,
        name: "message",
        description: "실행할 요청",
        required: true,
      },
      {
        type: DISCORD_COMMAND_OPTION_TYPE.ATTACHMENT,
        name: "attachment",
        description: "함께 분석할 첨부 파일",
      },
    ],
  },
  {
    name: "status",
    description: "현재 세션 상태를 확인합니다.",
  },
  {
    name: "jobs",
    description: "최근 작업 목록을 확인합니다.",
    options: [
      {
        type: DISCORD_COMMAND_OPTION_TYPE.INTEGER,
        name: "limit",
        description: "조회 개수",
        min_value: 1,
        max_value: 10,
      },
    ],
  },
  {
    name: "recent",
    description: "최근 대화 메시지를 확인합니다.",
    options: [
      {
        type: DISCORD_COMMAND_OPTION_TYPE.INTEGER,
        name: "count",
        description: "조회 개수",
        min_value: 1,
        max_value: 10,
      },
    ],
  },
  {
    name: "session",
    description: "현재 세션과 최근 세션 목록을 확인합니다.",
  },
  {
    name: "resume",
    description: "기존 세션으로 전환합니다.",
    options: [
      {
        type: DISCORD_COMMAND_OPTION_TYPE.STRING,
        name: "selector",
        description: "세션 ID 또는 최근 목록 번호",
        required: true,
      },
    ],
  },
  {
    name: "new",
    description: "새 세션을 시작합니다.",
  },
  {
    name: "model",
    description: "기본 모델을 조회하거나 변경합니다.",
    options: [
      {
        type: DISCORD_COMMAND_OPTION_TYPE.STRING,
        name: "value",
        description: "변경할 모델",
        choices: SUPPORTED_MODELS.map(toModelChoice),
      },
    ],
  },
  {
    name: "effort",
    description: "사고수준을 조회하거나 변경합니다.",
    options: [
      {
        type: DISCORD_COMMAND_OPTION_TYPE.STRING,
        name: "value",
        description: "변경할 사고수준",
        choices: SUPPORTED_REASONING_EFFORTS.map(toReasoningChoice),
      },
    ],
  },
  {
    name: "cancel",
    description: "현재 세션의 진행 중 작업을 취소합니다.",
  },
  {
    name: "help",
    description: "디스코드 명령 도움말을 확인합니다.",
  },
];

export function formatDiscordCommandHelp(): string {
  return [
    "Discord 명령 목록",
    ...DISCORD_COMMAND_DEFINITIONS.map((command) => {
      const usage = (command.options ?? []).map((option: DiscordApplicationCommandOption) => {
        const token = option.required ? `<${option.name}>` : `[${option.name}]`;
        return token;
      });
      return `/${command.name}${usage.length > 0 ? ` ${usage.join(" ")}` : ""} - ${command.description}`;
    }),
  ].join("\n");
}
