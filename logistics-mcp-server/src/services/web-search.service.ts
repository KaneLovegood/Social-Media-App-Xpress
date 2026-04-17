import axios from "axios";

export class WebSearchService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string): Promise<string> {
    if (!this.apiKey) {
      return "Web search API key not configured. Please set SERPER_API_KEY.";
    }

    try {
      const response = await axios.post(
        "https://google.serper.dev/search",
        { q: query },
        {
          headers: {
            "X-API-KEY": this.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data;
      if (data.organic && data.organic.length > 0) {
        return data.organic
          .slice(0, 5)
          .map((item: any, index: number) => 
            `[${index + 1}] ${item.title}\nSource: ${item.link}\nSnippet: ${item.snippet}`
          )
          .join("\n\n---\n\n");
      }

      return "No results found on the web.";
    } catch (error: any) {
      console.error("Web search error:", error.response?.data || error.message);
      return `Error performing web search: ${error.message}`;
    }
  }
}
