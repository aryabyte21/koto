import type { Provider } from "./base.js";
import { AnthropicProvider } from "./anthropic.js";
import { CustomProvider } from "./custom.js";
import { GoogleProvider } from "./google.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAIProvider } from "./openai.js";

export function createProvider(config: {
  name: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}): Provider {
  switch (config.name) {
    case "openai":
      return new OpenAIProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    case "google":
      return new GoogleProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    case "custom":
      return new CustomProvider(config);
    default:
      throw new Error(
        `Unknown provider "${config.name}". Available: openai, anthropic, google, ollama, custom`,
      );
  }
}
