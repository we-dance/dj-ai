// Fallback Spotify service for Vercel deployment
const axios = require('axios');
const express = require('express');
const crypto = require('crypto');

// Singleton instance
let spotifyServiceInstance = null;

// Simple Spotify service implementation
class SimpleSpotifyService {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.redirectUri = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/callback`
      : 'http://localhost:3000/callback';
    
    // In-memory tokens (will be lost on function restart)
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  getAuthorizationUrl(state, scopes) {
    const scopesStr = scopes.join(' ');
    const url = new URL('https://accounts.spotify.com/authorize');
    url.searchParams.append('client_id', this.clientId);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('redirect_uri', this.redirectUri);
    url.searchParams.append('state', state);
    url.searchParams.append('scope', scopesStr);
    return url.toString();
  }

  async exchangeCodeForTokens(code) {
    try {
      const response = await axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        params: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri
        },
        headers: {
          'Authorization': 'Basic ' + Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      return {
        access_token: this.accessToken,
        refresh_token: this.refreshToken,
        expires_in: response.data.expires_in
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  async getUserAccessToken() {
    if (!this.accessToken) {
      throw new Error('User is not authenticated');
    }
    
    if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
      await this.refreshAccessToken();
    }
    
    return this.accessToken;
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        params: {
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken
        },
        headers: {
          'Authorization': 'Basic ' + Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      if (response.data.refresh_token) {
        this.refreshToken = response.data.refresh_token;
      }
      
      return this.accessToken;
    } catch (error) {
      console.error('Error refreshing access token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }
}

// Get service instance
const getSimpleSpotifyService = () => {
  if (!spotifyServiceInstance) {
    spotifyServiceInstance = new SimpleSpotifyService();
  }
  return spotifyServiceInstance;
};

// Create minimal Spotify router
const createMinimalSpotifyRouter = () => {
  const router = express.Router();
  
  // Login endpoint
  router.get('/login', (req, res) => {
    try {
      // Generate a random state parameter to prevent CSRF attacks
      const state = crypto.randomBytes(16).toString('hex');
      
      // Define the scopes we want
      const scopes = [
        'playlist-read-private',
        'playlist-read-collaborative',
        'playlist-modify-public',
        'playlist-modify-private'
      ];
      
      const spotifyService = getSimpleSpotifyService();
      const authUrl = spotifyService.getAuthorizationUrl(state, scopes);
      
      // Redirect the user to Spotify's authorization page
      res.redirect(authUrl);
    } catch (error) {
      console.error("Error initiating Spotify login:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
  });
  
  return router;
};

module.exports = {
  getSimpleSpotifyService,
  createMinimalSpotifyRouter
}; 