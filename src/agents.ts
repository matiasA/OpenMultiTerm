export interface AgentDef {
  id: string
  name: string
  command: string
  color: string
  description: string
  install: {
    win: string
    mac: string
    linux: string
    url: string
  }
}

export const AGENTS: AgentDef[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    color: '#CC785C',
    description: "Anthropic's AI coding assistant",
    install: {
      win:   'npm install -g @anthropic-ai/claude-code',
      mac:   'npm install -g @anthropic-ai/claude-code',
      linux: 'npm install -g @anthropic-ai/claude-code',
      url:   'https://claude.ai/code',
    },
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    command: 'opencode',
    color: '#7c5cfc',
    description: 'Open source AI coding agent for the terminal',
    install: {
      win:   'npm install -g opencode-ai',
      mac:   'brew install opencode-ai/tap/opencode',
      linux: 'npm install -g opencode-ai',
      url:   'https://opencode.ai',
    },
  },
  {
    id: 'gh',
    name: 'Copilot CLI',
    command: 'gh',
    color: '#6e40c9',
    description: 'GitHub Copilot in the terminal via gh CLI',
    install: {
      win:   'winget install GitHub.cli\ngh extension install github/gh-copilot',
      mac:   'brew install gh\ngh extension install github/gh-copilot',
      linux: 'sudo apt install gh\ngh extension install github/gh-copilot',
      url:   'https://github.com/github/gh-copilot',
    },
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    color: '#4285F4',
    description: "Google's Gemini AI in your terminal",
    install: {
      win:   'npm install -g @google/gemini-cli',
      mac:   'npm install -g @google/gemini-cli',
      linux: 'npm install -g @google/gemini-cli',
      url:   'https://github.com/google-gemini/gemini-cli',
    },
  },
  {
    id: 'hermes',
    name: 'Hermes',
    command: 'hermes',
    color: '#FF6B35',
    description: 'Self-improving AI agent by Nous Research',
    install: {
      win:   'npm install -g @nousresearch/hermes-agent',
      mac:   'npm install -g @nousresearch/hermes-agent',
      linux: 'npm install -g @nousresearch/hermes-agent',
      url:   'https://hermes-agent.org',
    },
  },
  {
    id: 'clawbot',
    name: 'OpenClaw',
    command: 'clawbot',
    color: '#E63946',
    description: 'Self-hosted AI agent runtime with multi-channel support',
    install: {
      win:   'npm install -g @openclaw/clawbot',
      mac:   'npm install -g @openclaw/clawbot',
      linux: 'npm install -g @openclaw/clawbot',
      url:   'https://github.com/openclaw/openclaw',
    },
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    color: '#10A37F',
    description: "OpenAI's lightweight AI coding agent",
    install: {
      win:   'npm install -g @openai/codex',
      mac:   'npm install -g @openai/codex',
      linux: 'npm install -g @openai/codex',
      url:   'https://github.com/openai/codex',
    },
  },
]
