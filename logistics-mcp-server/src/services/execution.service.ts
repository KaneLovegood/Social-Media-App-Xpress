import { OpenRouter } from "@openrouter/sdk";

export class ExecutionService {
  private openrouter: InstanceType<typeof OpenRouter>;
  private model: string;

  constructor(openrouterApiKey: string) {
    this.model = process.env.OPENROUTER_MODEL || "openai/gpt-4o";
    this.openrouter = new OpenRouter({
      apiKey: openrouterApiKey,
      httpReferer: 'https://github.com/OpenClaw/OpenClaw',
      appTitle: 'MCP Server for Logistics',
    });
  }

  async createPlan(objective: string, constraints?: string): Promise<string> {
    const response = await this.openrouter.chat.send({
      chatGenerationParams: {
        model: this.model,
        messages: [
          { role: "system", content: "Generate a detailed operational logistics plan. Include phases, milestones, and resource requirements." },
          { role: "user", content: `Objective: ${objective}\nConstraints: ${constraints || "None"}` }
        ]
      }
    });
    return (response as any).choices[0].message.content || "No plan generated.";
  }

  async simulateOperation(scenario: string): Promise<any> {
    const response = await this.openrouter.chat.send({
      chatGenerationParams: {
        model: this.model,
        messages: [
          { role: "system", content: "Simulate the logistics scenario. Provide expected outcomes, efficiency scores, and potential critical paths." },
          { role: "user", content: scenario }
        ],
        responseFormat: { type: "json_object" }
      }
    });
    return JSON.parse((response as any).choices[0].message.content || "{}");
  }
}