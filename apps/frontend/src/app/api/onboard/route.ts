import { NextRequest, NextResponse } from 'next/server'
import { llmGenerate } from '@/lib/llm'

export const maxDuration = 60

const COMPANY_NAME = process.env.COMPANY_NAME || 'the company'
const COMPANY_DESCRIPTION = process.env.COMPANY_DESCRIPTION || ''

const SYSTEM_PROMPT = `You are an employee onboarding assistant for the AI Hub — a platform for managing AI virtual employees at ${COMPANY_NAME}${COMPANY_DESCRIPTION ? ` (${COMPANY_DESCRIPTION})` : ''}.

Virtual employees are AI agents that handle specific business functions. They use the hub's configured LLM provider and communicate via chat and Slack. Each employee needs:
- A role name and ID
- A Strategy document (6-month goals, deliverables, decision authority)
- A Personality document (communication style, values, tone)
- 3–8 skills (capability descriptions)

CONVERSATION FLOW:
1. Ask what kind of employee they want to create (role/function)
2. Clarify key responsibilities and goals
3. Suggest a name and ID, get confirmation
4. Guide through strategy (goals, deliverables, decision authority)
5. Define personality and communication style
6. Identify the key skills needed
7. Present a full summary for review
8. On confirmation, output the config JSON block

When the user confirms they are happy with the setup, output EXACTLY this JSON block with no text after it:

\`\`\`employee-config
{
  "id": "role-slug",
  "name": "Role Name",
  "description": "One sentence description of the role",
  "strategy": "# Strategy\\n\\n## Overview\\n\\n...\\n\\n## 6-Month Goals\\n\\n- Goal 1\\n- Goal 2\\n\\n## Key Deliverables\\n\\n| Deliverable | Frequency |\\n|-------------|-----------|\\n| Item | Weekly |\\n\\n## Decision Authority\\n\\n### Autonomous\\n\\n- Can do X without approval\\n\\n### Requires Approval\\n\\n- Needs sign-off for Y",
  "personality": "# Personality\\n\\n## Overview\\n\\n[Name] is...\\n\\n## Communication Style\\n\\n- Professional and direct\\n\\n## Core Values\\n\\n- Accuracy\\n- Efficiency\\n\\n## Domain Expertise\\n\\n...",
  "agentConfig": "[llm_overrides]\\nreason = gemini-3.1-pro-preview\\nwrite = gemini-3-flash-preview\\n\\n[human_gate]\\napprove_before = publish_external, send_email\\n\\n[mcp_servers]\\n# Add MCP server configurations here",
  "skills": [
    {"name": "skill-one.md", "content": "# Skill One\\n\\nDetailed description of this capability..."},
    {"name": "skill-two.md", "content": "# Skill Two\\n\\nDetailed description of this capability..."}
  ]
}
\`\`\`

Be conversational, helpful, and proactive. Suggest good defaults. Keep questions focused — one topic at a time. Generate rich, detailed Markdown content for Strategy and Personality. Use \\n for newlines inside JSON strings.`

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  // Gemini-style history rules also apply here: drop leading assistant turns.
  const allHistory = (messages as { role: string; content: string }[]).map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }))
  const firstUser = allHistory.findIndex((m) => m.role === 'user')
  const history = firstUser >= 0 ? allHistory.slice(firstUser) : []

  try {
    const result = await llmGenerate({
      system: SYSTEM_PROMPT,
      messages: history,
      role: 'write',
      run_name: 'onboarding-chat',
      metadata: { feature: 'onboarding' },
    })
    return NextResponse.json({ response: result.text })
  } catch (err) {
    console.error('LLM gateway error:', err)
    return NextResponse.json(
      { response: 'Error reaching the LLM gateway. Check that config-api is running and an LLM provider is configured.' },
      { status: 200 }
    )
  }
}
