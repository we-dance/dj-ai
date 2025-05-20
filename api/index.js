const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// Debug info for Vercel deployment
console.log(`Running in ${process.env.VERCEL ? 'Vercel' : 'local'} environment`);
console.log('Current directory:', process.cwd());
console.log('Files in current directory:', fs.readdirSync(process.cwd()));

// Try to list directories to help with debugging
try {
  if (fs.existsSync('./api')) {
    console.log('Files in api directory:', fs.readdirSync('./api'));
    
    if (fs.existsSync('./api/dist')) {
      console.log('Files in api/dist directory:', fs.readdirSync('./api/dist'));
    }
  }
  
  if (fs.existsSync('./dist')) {
    console.log('Files in dist directory:', fs.readdirSync('./dist'));
  }
} catch (err) {
  console.error('Error checking directories:', err);
}

// Initialize express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Simple router for testing
const generateRoutes = express.Router();
generateRoutes.post('/', (req, res) => {
  res.json({
    success: true,
    message: "Generate endpoint is working!",
    data: req.body
  });
});

// Create simple standalone Spotify router for testing
const spotifyRoutes = express.Router();
spotifyRoutes.get('/login', (req, res) => {
  res.json({
    success: true,
    message: "This is a placeholder for Spotify login. API is working!",
    testMode: true
  });
});

// Mount routes
app.use('/generate', generateRoutes);
app.use('/spotify', spotifyRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'DJ AI Server API is running',
    status: 'online',
    environment: process.env.NODE_ENV || 'development',
    isVercel: !!process.env.VERCEL,
    endpoints: {
      '/generate': 'POST - Test the generate endpoint',
      '/spotify/login': 'GET - Test the Spotify login endpoint'
    }
  });
});

// Simple HTML page for testing
app.get('/test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>DJ AI API Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .success { color: green; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1>DJ AI API Test Page</h1>
        <p>If you can see this page, the server is running correctly!</p>
        <div id="status">Checking API status...</div>
        
        <script>
          // Test the API endpoint
          fetch('/')
            .then(response => response.json())
            .then(data => {
              document.getElementById('status').innerHTML = 
                '<p class="success">✅ API is working! Response: ' + 
                JSON.stringify(data) + '</p>';
            })
            .catch(error => {
              document.getElementById('status').innerHTML = 
                '<p class="error">❌ Error: ' + error.message + '</p>';
            });
        </script>
      </body>
    </html>
  `);
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Set port and start server if running directly (not as a module)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the Express app
module.exports = app;