// Vercel serverless function for Express app
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const generateRoutes = require('../dist/routes/generate').default;
const spotifyRoutes = require('../dist/routes/spotify').default;
const { getSpotifyService } = require('../dist/routes/spotify');

// Create Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Add routes
app.use("/generate", generateRoutes);
app.use("/spotify", spotifyRoutes);

// Root route for health check
app.get('/', (req, res) => {
  res.json({
    message: "DJ AI Server API",
    status: "online",
    documentation: "/playlist-generator"
  });
});

// Serve the playlist generator page
app.get('/playlist-generator', (req, res) => {
  // This is the same HTML that's in your src/index.ts file
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>DJ AI Playlist Generator</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
          }
          h1 { color: #1DB954; text-align: center; }
          form { display: flex; flex-direction: column; }
          label { margin-top: 15px; font-weight: bold; }
          input, select { padding: 10px; margin: 5px 0 15px; border-radius: 5px; border: 1px solid #ddd; }
          button { 
            background-color: #1DB954; 
            color: white; 
            border: none; 
            padding: 12px; 
            border-radius: 5px; 
            margin-top: 20px; 
            cursor: pointer;
            font-weight: bold;
          }
          button:hover { background-color: #19a34a; }
          .result { 
            margin-top: 20px; 
            padding: 15px; 
            border: 1px solid #ddd; 
            border-radius: 5px; 
            background-color: #f9f9f9; 
            white-space: pre-wrap; 
            display: none;
          }
          .note {
            margin-top: 20px;
            padding: 15px;
            background-color: #fff8e1;
            border-left: 4px solid #ffc107;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>DJ AI Playlist Generator</h1>
          
          <form id="playlistForm">
            <label for="venue">Venue:</label>
            <input type="text" id="venue" name="venue" required placeholder="La Tropical, Casa de la Música, etc.">
            
            <label for="date">Date:</label>
            <input type="date" id="date" name="date" required>
            
            <label for="style">Style:</label>
            <select id="style" name="style" required>
              <option value="Timba heavy">Timba heavy</option>
              <option value="Traditional Son">Traditional Son</option>
              <option value="Mixed Cuban">Mixed Cuban</option>
              <option value="Contemporary Cuban fusion">Contemporary Cuban fusion</option>
            </select>
            
            <label for="playlistId">Spotify Playlist ID or URL:</label>
            <input type="text" id="playlistId" name="playlistId" placeholder="e.g., 37i9dQZF1DXdSjVZQzv2tl or full playlist URL">
            
            <div class="note">
              <p><strong>Note:</strong> You need to login with Spotify first to use this feature.</p>
              <p>If you haven't logged in yet, <a href="/spotify/login">click here to login with Spotify</a>.</p>
            </div>
            
            <button type="submit">Generate Playlist</button>
          </form>
          
          <div id="result" class="result"></div>
          <div id="loading" style="display: none; text-align: center; margin-top: 20px;">
            Generating playlist... This may take a minute or two.
          </div>
        </div>
        
        <script>
          document.getElementById('playlistForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const venue = document.getElementById('venue').value;
            const date = document.getElementById('date').value;
            const style = document.getElementById('style').value;
            const playlistId = document.getElementById('playlistId').value;
            
            const loadingDiv = document.getElementById('loading');
            const resultDiv = document.getElementById('result');
            
            resultDiv.style.display = 'none';
            loadingDiv.style.display = 'block';
            
            try {
              const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ venue, date, style, playlistId })
              });
              
              const data = await response.json();
              
              resultDiv.textContent = JSON.stringify(data, null, 2);
              resultDiv.style.display = 'block';
              
              if (data.success && data.data && data.data.newPlaylistId) {
                const playlistUrl = 'https://open.spotify.com/playlist/' + data.data.newPlaylistId;
                
                // Add playlist link to results
                const linkPara = document.createElement('p');
                linkPara.innerHTML = '<strong>Your playlist is ready!</strong> <a href="' + playlistUrl + '" target="_blank">Open in Spotify</a>';
                resultDiv.prepend(linkPara);
              }
            } catch (error) {
              resultDiv.textContent = 'Error generating playlist: ' + error.message;
              resultDiv.style.display = 'block';
            } finally {
              loadingDiv.style.display = 'none';
            }
          });
        </script>
      </body>
    </html>
  `);
});

// Spotify callback handler
app.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
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
    
    const spotifyService = getSpotifyService();
    await spotifyService.exchangeCodeForTokens(code);
    
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
          <meta http-equiv="refresh" content="3;url=/playlist-generator">
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
            <p>You will be redirected to the playlist generator in a few seconds...</p>
            <p class="redirect">If you're not redirected, <a href="/playlist-generator">click here</a>.</p>
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

// Export the Express API
module.exports = app; 