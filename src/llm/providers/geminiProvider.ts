import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { LLMProvider } from "../LLMProvider";

export class GeminiProvider implements LLMProvider {
  private model: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro-exp-03-25",
    });
  }

  async generate(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error("Error generating content with Gemini:", error);
      throw new Error(
        `Gemini API error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
