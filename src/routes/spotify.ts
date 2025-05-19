import { Router, Request, Response } from "express";
import { SpotifyService } from "../services/spotify";
import dotenv from "dotenv";
import path from "path";
import axios from "axios";
import crypto from "crypto";
import { songLibrary } from "../utils/songLibrary";

const router = Router();

// Create service only when needed - use a singleton pattern
let spotifyServiceInstance: SpotifyService | null = null;
export const getSpotifyService = () => {
  if (!spotifyServiceInstance) {
    try {
      spotifyServiceInstance = new SpotifyService();
    } catch (error) {
      console.error('Failed to create SpotifyService:', error);
      throw error;
    }
  }
  return spotifyServiceInstance;
};

/**
 * GET /spotify/login
 * Redirects to Spotify's authorization page
 */
router.get("/login", (req: Request, res: Response) => {
  try {
    // Generate a random state parameter to prevent CSRF attacks
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store the state in the session or a cookie (you'd need session middleware for this)
    // For this example, we'll just append it to the redirect URL as a query parameter
    
    // Define the scopes we want
    const scopes = [
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-public',
      'playlist-modify-private'
    ];
    
    const spotifyService = getSpotifyService();
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

/**
 * GET /spotify/callback
 * Handles the callback from Spotify after authorization
 */
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;
    
    // Check if there was an error or the user denied permission
    if (error) {
      return res.status(400).json({
        success: false,
        error: `Authorization failed: ${error}`
      });
    }
    
    // Verify the state parameter matches what we sent
    // In a real app, you'd compare with the state stored in the session/cookie
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: "Authorization code not received"
      });
    }
    
    // Exchange the code for access and refresh tokens
    const spotifyService = getSpotifyService();
    await spotifyService.exchangeCodeForTokens(code as string);
    
    // Redirect to a success page or the app's main page
    res.redirect('/spotify/user-playlists');
  } catch (error) {
    console.error("Error handling Spotify callback:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    });
  }
});

/**
 * GET /spotify/user-playlists
 * Get the current user's playlists (requires user to be authenticated)
 */
router.get("/user-playlists", async (req: Request, res: Response) => {
  try {
    console.log('Attempting to fetch user playlists...');
    const spotifyService = getSpotifyService();
    
    // Check if we have user tokens before attempting to get playlists
    try {
      // This will throw if not authenticated
      await spotifyService.getUserAccessToken();
      console.log('User is authenticated, proceeding to fetch playlists');
    } catch (authError) {
      console.log('User not authenticated, redirecting to login');
      return res.redirect('/spotify/login');
    }
    
    const playlists = await spotifyService.getUserPlaylists();
    console.log(`Successfully retrieved ${playlists.length} playlists`);
    
    return res.status(200).json({
      success: true,
      data: {
        count: playlists.length,
        playlists
      }
    });
  } catch (error) {
    console.error("Error fetching user playlists:", error);
    
    // If the error is due to not being authenticated, redirect to login
    if (error instanceof Error && error.message === 'User is not authenticated') {
      return res.redirect('/spotify/login');
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    });
  }
});

/**
 * GET /spotify/user-playlist/:id/tracks
 * Get tracks from a specific playlist using user authentication
 */
router.get("/user-playlist/:id/tracks", async (req: Request, res: Response) => {
  try {
    const playlistId = req.params.id;
    
    if (!playlistId) {
      return res.status(400).json({
        success: false,
        error: "Playlist ID is required"
      });
    }
    
    const spotifyService = getSpotifyService();
    const tracks = await spotifyService.getUserPlaylistTracks(playlistId);
    
    return res.status(200).json({
      success: true,
      data: {
        playlistId,
        trackCount: tracks.length,
        tracks
      }
    });
  } catch (error) {
    console.error("Error fetching user playlist tracks:", error);
    
    // If the error is due to not being authenticated, redirect to login
    if (error instanceof Error && error.message === 'User is not authenticated') {
      return res.redirect('/spotify/login');
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    });
  }
});

/**
 * GET /spotify/artist
 * Now requires an ID parameter instead of using a default artist
 */
router.get("/artist", async (req: Request, res: Response) => {
  try {
    const artistId = req.query.id as string;
    
    if (!artistId) {
      return res.status(400).json({
        success: false,
        error: "Artist ID is required as a query parameter"
      });
    }
    
    const spotifyService = getSpotifyService();
    const artist = await spotifyService.getArtist(artistId);
    
    return res.status(200).json({
      success: true,
      data: { artist }
    });
  } catch (error) {
    console.error("Error fetching artist:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    });
  }
});

/**
 * GET /spotify/new-releases
 * Gets latest album releases
 */
router.get("/new-releases", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    
    const spotifyService = getSpotifyService();
    const releases = await spotifyService.getNewReleases(limit);
    
    return res.status(200).json({
      success: true,
      data: {
        count: releases.length,
        releases
      }
    });
  } catch (error) {
    console.error("Error fetching new releases:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    });
  }
});

/**
 * GET /spotify/featured-playlists
 * Get a list of Spotify featured playlists
 */
router.get("/featured-playlists", async (req: Request, res: Response) => {
  try {
    const spotifyService = getSpotifyService();
    const playlists = await spotifyService.getFeaturedPlaylists();
    
    return res.status(200).json({
      success: true,
      data: {
        playlists
      }
    });
  } catch (error) {
    console.error("Error fetching featured playlists:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    });
  }
});

/**
 * GET /spotify/verify
 * Verifies Spotify authentication is working
 */
router.get("/verify", async (req: Request, res: Response) => {
  try {
    const spotifyService = getSpotifyService();
    // This will trigger authentication without making additional API calls
    await spotifyService.verifyAuthentication();
    
    return res.status(200).json({
      success: true,
      message: "Spotify authentication successful"
    });
  } catch (error) {
    console.error("Error verifying Spotify authentication:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    });
  }
});

/**
 * GET /spotify/playlist/tracks
 * Now requires an ID parameter instead of using a default playlist
 */
router.get("/playlist/tracks", async (req: Request, res: Response) => {
  try {
    const playlistId = req.query.id as string;
    
    if (!playlistId) {
      return res.status(400).json({
        success: false,
        error: "Playlist ID is required as a query parameter"
      });
    }
    
    const spotifyService = getSpotifyService();
    const tracks = await spotifyService.getPlaylistTracks(playlistId);
    
    return res.status(200).json({
      success: true,
      data: {
        playlistId,
        trackCount: tracks.length,
        tracks
      }
    });
  } catch (error) {
    console.error("Error fetching playlist tracks:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    });
  }
});

/**
 * GET /spotify/playlist/:id/tracks
 * Fetches all tracks from a specified playlist
 */
router.get("/playlist/:id/tracks", async (req: Request, res: Response) => {
  try {
    const playlistId = req.params.id;
    
    if (!playlistId) {
      return res.status(400).json({
        success: false,
        error: "Playlist ID is required"
      });
    }
    
    const spotifyService = getSpotifyService();
    const tracks = await spotifyService.getPlaylistTracks(playlistId);
    
    return res.status(200).json({
      success: true,
      data: {
        playlistId,
        trackCount: tracks.length,
        tracks
      }
    });
  } catch (error) {
    console.error("Error fetching playlist tracks:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    });
  }
});

/**
 * GET /spotify/create-library-playlist
 * Creates a playlist with all songs from the songLibrary
 * This endpoint should only be called once
 * TODO: remove this endpoint
 */
router.get("/create-library-playlist", async (req: Request, res: Response) => {
  try {
    console.log('Attempting to create playlist with song library...');
    const spotifyService = getSpotifyService();
    
    // Check if we have user tokens before proceeding
    try {
      await spotifyService.getUserAccessToken();
      console.log('User is authenticated, proceeding to create playlist');
    } catch (authError) {
      console.log('User not authenticated, redirecting to login');
      return res.redirect('/spotify/login');
    }
    
    // Parse the song library
    const songList = songLibrary
      .trim()
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.trim());
    
    console.log(`Parsed ${songList.length} songs from song library`);
    
    // Create a new playlist
    const playlistName = "DJ AI Song Library";
    const playlistDescription = "Automatically generated playlist containing all songs from the DJ AI library";
    const playlistId = await spotifyService.createPlaylist(playlistName, playlistDescription, false);
    
    // Search for each song and collect URIs
    console.log("Searching for songs on Spotify...");
    const trackUris: string[] = [];
    const notFound: string[] = [];
    let foundCount = 0;
    
    // Process songs in batches to avoid overwhelming the API
    for (const song of songList) {
      const uri = await spotifyService.searchTrack(song);
      if (uri) {
        trackUris.push(uri);
        foundCount++;
        if (foundCount % 10 === 0) {
          console.log(`Found ${foundCount} songs so far...`);
        }
      } else {
        notFound.push(song);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Found ${trackUris.length} songs on Spotify, ${notFound.length} songs not found`);
    
    // Add the found tracks to the playlist
    if (trackUris.length > 0) {
      await spotifyService.addTracksToPlaylist(playlistId, trackUris);
      console.log(`Successfully added ${trackUris.length} tracks to playlist ${playlistId}`);
    }
    
    return res.status(200).json({
      success: true,
      data: {
        playlistId,
        playlistName,
        totalSongs: songList.length,
        foundSongs: trackUris.length,
        notFoundSongs: notFound.length,
        notFound: notFound
      }
    });
    
  } catch (error) {
    console.error("Error creating library playlist:", error);
    
    // If the error is due to not being authenticated, redirect to login
    if (error instanceof Error && error.message === 'User is not authenticated') {
      return res.redirect('/spotify/login');
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    });
  }
});

export default router; 