# DJ AI Server

A Node.js REST API backend that generates music playlists using various LLM providers and Spotify integration.

## Features

- Modular architecture supporting multiple LLM providers
- Currently supports Gemini and Deepseek LLMs
- Spotify API integration for playlist creation
- Generate AI playlists based on venue, date, and music style
- Use your existing Spotify playlists as seed libraries
- Create and manage a DJ AI Song Library
- Easy to extend with additional LLM providers

## Getting Started

### Prerequisites

- Node.js v16 or later
- npm or yarn or pnpm
- API keys for at least one of the supported LLM providers:
  - Gemini API key from [Google AI Studio](https://ai.google.dev/)
  - Deepseek API key from [Deepseek API](https://platform.deepseek.com/)
- Spotify Developer account and API credentials:
  - Register a new app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
  - Set the redirect URI to `http://127.0.0.1:3000/callback`

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

4. Edit the `.env` file and add your API keys and preferences:
   ```
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=your_gemini_api_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   PORT=3000
   ```

### Running the Server

Start the server in development mode with auto-reload:
```bash
pnpm dev
```

## Using the Application

### Step 1: Start the Server
Run the server with:
```bash
pnpm dev
```
The server will start on port 3000 (or the port specified in your .env file).

### Step 2: Access the Playlist Generator
Open your browser and navigate to:
```
http://127.0.0.1:3000/playlist-generator
```

### Step 3: Authenticate with Spotify
- Click on the "Login with Spotify" link
- Authorize the application when prompted by Spotify
- You'll be redirected back to the playlist generator

### Step 4: Generate a Playlist
1. Fill in the required fields:
   - **Venue**: Enter the venue name (e.g., "La Tropical", "Casa de la Música")
   - **Date**: Select the event date
   - **Style**: Choose the music style from the dropdown (e.g., "Timba heavy", "Traditional Son")
   - **Spotify Playlist ID or URL** (optional): Enter a Spotify playlist ID or URL to use as the source library
     - If left empty, the app will use the "DJ AI Song Library" playlist

2. Click "Generate Playlist"
3. Wait for the AI to generate the playlist (this may take a minute or two)
4. Once completed, you'll see a link to open the newly created playlist in Spotify

### Step 5: Enjoy Your AI-Generated Playlist
The new playlist will be available in your Spotify account with the songs organized into:
- Warmup songs
- Peak time songs
- Cooldown songs

## Limitations

- **BPM Detection**: The application cannot access Spotify's "Audio Features" API to get BPM (tempo) information. This is a limitation of the Spotify API permissions. The AI makes recommendations based on music style and not actual BPM data.
- **Library Creation**: First-time users will need to create a "DJ AI Song Library" (can be any name) playlist by using the application or by himself.

## API Usage

### Generate a Playlist

**Endpoint:** `POST /generate`

**Request Body:**
```json
{
  "venue": "La Tropical",
  "date": "2023-07-15",
  "style": "Timba heavy",
  "playlistId": "spotify:playlist:37i9dQZF1DXdSjVZQzv2tl"
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
      "venue": "La Tropical",
      "date": "2023-07-15",
      "style": "Timba heavy"
    }
  }
}
```

## Configuration

You can configure the following options in your `.env` file:

- `LLM_PROVIDER`: The LLM provider to use (options: "gemini", "deepseek")
- `GEMINI_API_KEY`: Your Google Gemini API key
- `DEEPSEEK_API_KEY`: Your Deepseek API key
- `SPOTIFY_CLIENT_ID`: Your Spotify application client ID
- `SPOTIFY_CLIENT_SECRET`: Your Spotify application client secret
- `PORT`: Server port (default: 3000)

## Extending with New Providers

To add a new LLM provider:

1. Create a new provider class in `src/llm/providers/` that implements the `LLMProvider` interface
2. Add the new provider to the factory in `src/llm/providerFactory.ts`
3. Update the environment variable options

## License

[MIT License](LICENSE) 