# DJ AI Server

A Node.js REST API backend that generates music playlists using various LLM providers.

## Features

- Modular architecture supporting multiple LLM providers
- Currently supports Gemini and Deepseek LLMs
- Simple API for generating playlist based on venue, date, and music style
- Easy to extend with additional LLM providers

## Getting Started

### Prerequisites

- Node.js v16 or later
- npm or yarn
- API keys for at least one of the supported LLM providers:
  - Gemini API key from [Google AI Studio](https://ai.google.dev/)
  - Deepseek API key from [Deepseek API](https://platform.deepseek.com/)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/dj-ai-server.git
   cd dj-ai
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Create a `.env` file by copying the example
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file and add your API keys and preferences

### Running the Server

Development mode with auto-reload:
```bash
pnpm dev
```

Production mode:
```bash
pnpm start
```

## API Usage

### Generate a Playlist

**Endpoint:** `POST /generate`

**Request Body:**
```json
{
  "venue": "beach party",
  "date": "2023-07-15",
  "style": "deep house"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "playlist": "... generated playlist content ...",
    "provider": "gemini",
    "inputs": {
      "venue": "beach party",
      "date": "2023-07-15",
      "style": "deep house"
    }
  }
}
```

## Configuration

You can configure the following options in your `.env` file:

- `LLM_PROVIDER`: The LLM provider to use (options: "gemini", "deepseek")
- `GEMINI_API_KEY`: Your Google Gemini API key
- `DEEPSEEK_API_KEY`: Your Deepseek API key
- `PORT`: Server port (default: 3000)

## Extending with New Providers

To add a new LLM provider:

1. Create a new provider class in `src/llm/providers/` that implements the `LLMProvider` interface
2. Add the new provider to the factory in `src/llm/providerFactory.ts`
3. Update the environment variable options

## License

[MIT License](LICENSE) 