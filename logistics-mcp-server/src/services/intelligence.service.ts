import { OpenRouter } from "@openrouter/sdk";
import { SearchService } from "./search.service.js";

export class IntelligenceService {
  private openrouter: InstanceType<typeof OpenRouter>;
  private model: string;

  constructor(private searchService: SearchService, openrouterApiKey: string) {
    this.model = process.env.OPENROUTER_MODEL || "openai/gpt-4o";
    this.openrouter = new OpenRouter({
      apiKey: openrouterApiKey,
      httpReferer: 'https://github.com/OpenClaw/OpenClaw',
      appTitle: 'MCP Server for Logistics',
    });
  }

  async askQuestion(question: string): Promise<string> {
    const queryVector = await this.searchService.getEmbedding(question);
    const results = await this.searchService.vectorSearch(queryVector, 3);
    const context = results.map((r: any) => r.content).join("\n\n");

    const response = await this.openrouter.chat.send({
      chatGenerationParams: {
        model: this.model,
        messages: [
          { role: "system", content: "You are a Logistics Expert. Answer questions based on the provided context if possible, or use your internal knowledge of OTT processes if context is missing." },
          { role: "user", content: `Context: ${context || "None"}\n\nQuestion: ${question}` }
        ]
      }
    });

    return (response as any).choices[0].message.content || "No response generated.";
  }

  async analyzeFlow(flowDescription: string): Promise<any> {
    const response = await this.openrouter.chat.send({
      chatGenerationParams: {
        model: this.model,
        messages: [
          { role: "system", content: "Analyze the logistics flow. Identify bottlenecks, risks, and suggestions. Return the result in a structured format." },
          { role: "user", content: flowDescription }
        ],
        responseFormat: { type: "json_object" }
      }
    });
    return JSON.parse((response as any).choices[0].message.content || "{}");
  }

  async recommendSolutions(problem: string): Promise<string> {
    const response = await this.openrouter.chat.send({
      chatGenerationParams: {
        model: this.model,
        messages: [
          { role: "system", content: "Provide at least 3 solutions for the logistics problem. Format as a bulleted list." },
          { role: "user", content: problem }
        ]
      }
    });
    return (response as any).choices[0].message.content || "No solutions found.";
  }

  async summarizeTopic(topic: string): Promise<string> {
    const response = await this.openrouter.chat.send({
      chatGenerationParams: {
        model: this.model,
        messages: [
          { role: "system", content: "You are a Logistics Expert. Provide a clear, structured, and comprehensive summary of the given logistics topic. Include key concepts, current trends, and practical applications." },
          { role: "user", content: `Please summarize this logistics topic: ${topic}` }
        ]
      }
    });
    return (response as any).choices[0].message.content || "No summary generated.";
  }
}