const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// Debug info for Vercel deployment
const isVercel = process.env.VERCEL === '1';
console.log(`Running in ${isVercel ? 'Vercel' : 'local'} environment`);
console.log('Current directory:', process.cwd());

try {
  const distExists = fs.existsSync('./dist');
  const apiDistExists = fs.existsSync('./api/dist');
  console.log(`./dist exists: ${distExists}`);
  console.log(`./api/dist exists: ${apiDistExists}`);
  
  if (distExists) {
    console.log('Contents of ./dist:', fs.readdirSync('./dist'));
    if (fs.existsSync('./dist/routes')) {
      console.log('Contents of ./dist/routes:', fs.readdirSync('./dist/routes'));
    }
  }
  
  if (apiDistExists) {
    console.log('Contents of ./api/dist:', fs.readdirSync('./api/dist'));
    if (fs.existsSync('./api/dist/routes')) {
      console.log('Contents of ./api/dist/routes:', fs.readdirSync('./api/dist/routes'));
    }
  }
} catch (err) {
  console.error('Error checking directories:', err);
}

// Initialize express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Try to load the TypeScript compiled modules or provide fallbacks
let generateRoutes;
let spotifyRoutes;

// Try to load the generate routes
try {
  // Try multiple possible paths
  const possiblePaths = [
    '../dist/routes/generate.js',
    './dist/routes/generate.js',
    './api/dist/routes/generate.js'
  ];
  
  let generateModule = null;
  for (const modulePath of possiblePaths) {
    try {
      generateModule = require(modulePath);
      console.log(`Successfully loaded generate routes from ${modulePath}`);
      break;
    } catch (err) {
      console.log(`Failed to load from ${modulePath}:`, err.message);
    }
  }
  
  if (generateModule) {
    generateRoutes = generateModule.default || generateModule;
  } else {
    throw new Error('Could not find generate routes module in any location');
  }
} catch (error) {
  console.error('Error loading generate routes:', error);
  // Fallback for generate routes
  generateRoutes = express.Router().get('/*', (req, res) => {
    res.status(500).json({ error: 'Generate module not available' });
  });
}

// Try to load the spotify routes
try {
  // Try multiple possible paths
  const possiblePaths = [
    '../dist/routes/spotify.js',
    './dist/routes/spotify.js',
    './api/dist/routes/spotify.js'
  ];
  
  let spotifyModule = null;
  for (const modulePath of possiblePaths) {
    try {
      spotifyModule = require(modulePath);
      console.log(`Successfully loaded spotify routes from ${modulePath}`);
      break;
    } catch (err) {
      console.log(`Failed to load from ${modulePath}:`, err.message);
    }
  }
  
  if (spotifyModule) {
    spotifyRoutes = spotifyModule.default || spotifyModule;
  } else {
    throw new Error('Could not find spotify routes module in any location');
  }
} catch (error) {
  console.error('Error loading spotify routes:', error);
  
  // Try to load the standalone spotify module as a fallback
  try {
    const standaloneSpotify = require('./standalone-spotify');
    console.log('Loaded standalone Spotify module as fallback');
    spotifyRoutes = standaloneSpotify.createMinimalSpotifyRouter();
  } catch (fallbackError) {
    console.error('Failed to load standalone Spotify module:', fallbackError);
    // Final fallback if even the standalone module fails
    spotifyRoutes = express.Router().get('/*', (req, res) => {
      res.status(500).json({ error: 'Spotify module not available' });
    });
  }
}

// Mount routes
app.use('/generate', generateRoutes);
app.use('/spotify', spotifyRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'DJ AI Server API',
    ui: {
      '/playlist-generator': 'UI to generate AI playlists from Spotify playlists'
    },
    endpoints: {
      '/generate': 'POST - Generate a music playlist (required: venue, date, style; optional: playlistId, useSpotifyLibrary)',
      '/spotify/generate-from-playlist': 'POST - Generate a playlist from a specific Spotify playlist (required: playlistId)',
      '/spotify/generate-ai-playlist': 'POST - Generate a playlist from the DJ AI Song Library (required: venue, date, style)',
      '/spotify/verify': 'GET - Verify Spotify API authentication'
    }
  });
});

// Callback route for Spotify OAuth
app.get('/callback', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="refresh" content="3;url=/playlist-generator" />
        <title>Redirecting...</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; }
          .container { max-width: 600px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Successfully logged in with Spotify!</h1>
          <p>You will be redirected to the playlist generator in a few seconds.</p>
          <p>If you are not redirected, <a href="/playlist-generator">click here</a>.</p>
        </div>
      </body>
    </html>
  `);
});

// Serve the playlist generator HTML
app.get('/playlist-generator', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>DJ AI Playlist Generator</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #1DB954;
            text-align: center;
          }
          form {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .form-group {
            margin-bottom: 15px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
          }
          input, select {
            width: 100%;
            padding: 8px;
            box-sizing: border-box;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          button {
            background: #1DB954;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
          }
          button:hover {
            background: #18a448;
          }
          #result {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            min-height: 100px;
          }
          .note {
            font-size: 14px;
            color: #666;
            margin-top: 8px;
          }
          .loading {
            text-align: center;
            color: #666;
          }
          .error {
            color: #d9534f;
            background: #f9f2f2;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
          }
          .success {
            color: #5cb85c;
          }
        </style>
      </head>
      <body>
        <h1>DJ AI Playlist Generator</h1>
        <p>Create AI-generated DJ sets based on your Spotify playlists</p>
        
        <form id="playlistForm">
          <div class="form-group">
            <label for="venue">Venue:</label>
            <input type="text" id="venue" name="venue" placeholder="e.g. Beach Club" required>
          </div>
          
          <div class="form-group">
            <label for="date">Date:</label>
            <input type="date" id="date" name="date" required>
          </div>
          
          <div class="form-group">
            <label for="style">Style:</label>
            <select id="style" name="style" required>
              <option value="">-- Select a style --</option>
              <option value="lounge">Lounge</option>
              <option value="deep house">Deep House</option>
              <option value="tech house">Tech House</option>
              <option value="progressive house">Progressive House</option>
              <option value="drum and bass">Drum and Bass</option>
              <option value="trance">Trance</option>
              <option value="techno">Techno</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="playlistId">Spotify Playlist ID or URL:</label>
            <input type="text" id="playlistId" name="playlistId" placeholder="e.g. https://open.spotify.com/playlist/37i9dQZF1DX6tEG8AQim1C">
            <p class="note">Enter a Spotify playlist URL or ID to use your own playlist as a source.</p>
          </div>
          
          <p class="note">Note: You need to <a href="/spotify/login">login with Spotify</a> to use this feature.</p>
          
          <button type="submit">Generate Playlist</button>
        </form>
        
        <div id="result">
          <p>Results will appear here...</p>
        </div>
        
        <script>
          document.getElementById('playlistForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<p class="loading">Generating your playlist... This may take a minute...</p>';
            
            const venue = document.getElementById('venue').value;
            const date = document.getElementById('date').value;
            const style = document.getElementById('style').value;
            const playlistId = document.getElementById('playlistId').value;
            
            try {
              const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  venue,
                  date,
                  style,
                  playlistId: playlistId || undefined
                })
              });
              
              const data = await response.json();
              
              if (!response.ok) {
                resultDiv.innerHTML = '<div class="error">' + (data.error || 'An error occurred') + '</div>';
                return;
              }
              
              let resultHtml = '<h3>Your AI-Generated Playlist:</h3>';
              
              if (data.playlistUrl) {
                resultHtml += '<p class="success">✅ Playlist created! <a href="' + data.playlistUrl + '" target="_blank">Open in Spotify</a></p>';
              }
              
              if (data.playlist && data.playlist.length > 0) {
                resultHtml += '<ol>';
                data.playlist.forEach(track => {
                  resultHtml += '<li>' + track.name + ' - ' + track.artists.join(', ') + '</li>';
                });
                resultHtml += '</ol>';
              }
              
              resultDiv.innerHTML = resultHtml;
            } catch (error) {
              resultDiv.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
            }
          });
          
          // Set default date to today
          document.getElementById('date').valueAsDate = new Date();
        </script>
      </body>
    </html>
  `);
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Export the Express app
module.exports = app;