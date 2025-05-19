import dotenv from "dotenv";
import path from "path";

// Try with explicit path
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import express, { Request, Response } from "express";
import cors from "cors";
import generateRoutes from "./routes/generate";
import spotifyRoutes from "./routes/spotify";
import { getSpotifyService } from "./routes/spotify";


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/generate", generateRoutes);
app.use("/spotify", spotifyRoutes);

// This route handles Spotify callback at the root level to match the registered redirect URI
app.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;
    
    // Check if there was an error or the user denied permission
    if (error) {
      return res.status(400).json({
        success: false,
        error: `Authorization failed: ${error}`
      });
    }
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: "Authorization code not received"
      });
    }
    
    // Exchange the code for access and refresh tokens
    const spotifyService = getSpotifyService();
    await spotifyService.exchangeCodeForTokens(code as string);
    
    // Return an HTML page with success message and auto-redirect after 3 seconds
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
          <meta http-equiv="refresh" content="3;url=/spotify/user-playlists">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              margin-top: 50px; 
              background-color: #f5f5f5;
            }
            .container {
              background-color: white;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              padding: 30px;
              max-width: 600px;
              margin: 0 auto;
            }
            h1 { color: #1DB954; }
            p { margin: 20px 0; }
            .redirect { color: #999; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Authentication Successful!</h1>
            <p>Your Spotify account has been connected successfully.</p>
            <p>You will be redirected to your playlists in a few seconds...</p>
            <p class="redirect">If you're not redirected, <a href="/spotify/user-playlists">click here</a>.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error handling Spotify callback:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    });
  }
});

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "DJ AI Server API",
    endpoints: [
      {
        path: "/generate",
        method: "POST",
        description: "Generate a music playlist",
        body: {
          venue: "string (required)",
          date: "string (required)",
          style: "string (required)",
        },
      },
      {
        path: "/spotify/verify",
        method: "GET",
        description: "Verify Spotify API authentication is working",
      },
      {
        path: "/spotify/artist",
        method: "GET",
        description: "Get information about the default artist (Taylor Swift)",
      },
      {
        path: "/spotify/artist/:id",
        method: "GET",
        description: "Get information about a specific artist",
        params: {
          id: "string (required) - Spotify artist ID",
        },
      },
      {
        path: "/spotify/new-releases",
        method: "GET",
        description: "Get latest album releases from Spotify",
        query: {
          limit: "number (optional) - Number of releases to retrieve (default: 20)",
        },
      },
      // User authentication endpoints
      {
        path: "/spotify/login",
        method: "GET",
        description: "Redirects to Spotify login page for authorization",
      },
      {
        path: "/spotify/callback",
        method: "GET",
        description: "Callback endpoint for Spotify OAuth",
        query: {
          code: "string - Authorization code from Spotify",
          state: "string - State parameter for security"
        }
      },
      {
        path: "/spotify/user-playlists",
        method: "GET",
        description: "Get the current user's playlists (requires user authentication)",
      },
      {
        path: "/spotify/user-playlist/:id/tracks",
        method: "GET",
        description: "Get tracks from a specific playlist using user authentication",
        params: {
          id: "string (required) - Spotify playlist ID",
        },
      },
      // Client credentials endpoints (limited access)
      {
        path: "/spotify/featured-playlists",
        method: "GET",
        description: "Get a list of Spotify featured playlists (may require user authentication)",
      },
      {
        path: "/spotify/playlist/tracks",
        method: "GET",
        description: "Get tracks from the default Spotify playlist (may require user authentication)",
      },
      {
        path: "/spotify/playlist/:id/tracks",
        method: "GET",
        description: "Get tracks from a specific Spotify playlist (may require user authentication)",
        params: {
          id: "string (required) - Spotify playlist ID",
        },
      },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Active LLM provider: ${process.env.LLM_PROVIDER || "gemini (default)"}`
  );
  console.log('Spotify Client ID available:', !!process.env.SPOTIFY_CLIENT_ID);
  console.log('Spotify Client Secret available:', !!process.env.SPOTIFY_CLIENT_SECRET);
});
