import axios from "axios";
import { LLMProvider } from "../LLMProvider";

export class DeepseekProvider implements LLMProvider {
  private apiKey: string;
  private endpoint: string = "https://api.deepseek.com/v1/chat/completions";
  private model: string = "deepseek-chat";

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY environment variable is not set");
    }

    this.apiKey = apiKey;
  }

  async generate(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        this.endpoint,
        {
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const message = response.data.choices[0]?.message?.content;

      if (!message) {
        throw new Error("Unexpected response format from Deepseek API");
      }

      return message;
    } catch (error) {
      console.error("Error generating content with Deepseek:", error);
      throw new Error(
        `Deepseek API error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
