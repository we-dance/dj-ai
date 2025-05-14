import { LLMProvider } from "./LLMProvider";
import { GeminiProvider } from "./providers/geminiProvider";
import { DeepseekProvider } from "./providers/deepseekProvider";

export class ProviderFactory {
  static getProvider(): LLMProvider {
    const providerName = process.env.LLM_PROVIDER?.toLowerCase() || "gemini";

    switch (providerName) {
      case "gemini":
        return new GeminiProvider();
      case "deepseek":
        return new DeepseekProvider();
      default:
        throw new Error(`Unsupported LLM provider: ${providerName}`);
    }
  }
}
