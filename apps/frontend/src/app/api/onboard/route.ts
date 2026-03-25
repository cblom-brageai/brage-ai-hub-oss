import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

const SYSTEM_PROMPT = `You are an employee onboarding assistant for the Brage AI Hub — a platform for managing AI virtual employees at a Norwegian renewable energy company called Brage.

Virtual employees are AI agents that handle specific business functions. They use Google Gemini LLM and communicate via chat and Slack. Each employee needs:
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

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { response: 'GOOGLE_API_KEY is not configured. Add it to your .env.local file.' },
      { status: 200 }
    )
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      systemInstruction: SYSTEM_PROMPT,
    })

    // Convert messages to Gemini format (all but the last as history).
    // Gemini requires history to start with a 'user' turn — drop any leading model messages.
    const allHistory = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))
    const firstUser = allHistory.findIndex((m: { role: string }) => m.role === 'user')
    const history = firstUser >= 0 ? allHistory.slice(firstUser) : []

    const lastMessage = messages[messages.length - 1].content

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(lastMessage)
    const text = result.response.text()

    return NextResponse.json({ response: text })
  } catch (err) {
    console.error('Gemini API error:', err)
    return NextResponse.json({ response: 'Error connecting to Gemini. Check your API key.' }, { status: 200 })
  }
}
