import axios from "axios";
import querystring from "querystring";
import dotenv from "dotenv";
import path from "path";

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  uri: string;
  duration_ms: number;
}

export interface UserTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class SpotifyService {
  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private redirectUri: string | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  // For user-specific tokens
  private userTokens: Map<string, UserTokens> = new Map();

  constructor() {
    // Initialize will be called lazily when credentials are needed
  }

  /**
   * Initialize credentials from environment variables
   * Called on demand to ensure environment variables are loaded
   */
  private initialize() {
    if (!this.clientId || !this.clientSecret) {
      console.log("Raw SPOTIFY_CLIENT_ID:", process.env.SPOTIFY_CLIENT_ID);
      console.log(
        "Raw SPOTIFY_CLIENT_SECRET:",
        process.env.SPOTIFY_CLIENT_SECRET
      );

      this.clientId = process.env.SPOTIFY_CLIENT_ID || "";
      this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
      this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || "";

      console.log("Assigned clientId:", this.clientId);
      console.log(
        "Assigned clientSecret length:",
        this.clientSecret ? this.clientSecret.length : 0
      );

      if (!this.clientId || !this.clientSecret) {
        console.error(
          "Spotify credentials not found. Available env vars:",
          Object.keys(process.env).filter((key) => key.includes("SPOTIFY"))
        );
        throw new Error(
          "Spotify client ID and client secret must be defined in .env file"
        );
      }
    }
  }

  /**
   * Get an access token using client credentials flow
   * This is for server-to-server API calls that don't require user permissions
   */
  private async getAccessToken(): Promise<string> {
    // Initialize credentials if not already done
    this.initialize();

    // Return existing token if it's still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const authOptions = {
        url: "https://accounts.spotify.com/api/token",
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(this.clientId + ":" + this.clientSecret).toString(
              "base64"
            ),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: querystring.stringify({
          grant_type: "client_credentials",
        }),
      };

      const response = await axios(authOptions);

      this.accessToken = response.data.access_token;
      // Set expiry time (subtract 60 seconds to be safe)
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;

      if (!this.accessToken) {
        throw new Error("No access token received from Spotify API");
      }

      return this.accessToken;
    } catch (error) {
      console.error("Error getting Spotify access token:", error);
      throw new Error("Failed to authenticate with Spotify API");
    }
  }

  /**
   * Simply verify that authentication is working by getting an access token
   * This does not make any API calls beyond getting the token
   */
  async verifyAuthentication(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      return !!token;
    } catch (error) {
      console.error("Error verifying authentication:", error);
      throw new Error("Failed to verify Spotify authentication");
    }
  }

  /**
   * Generate the authorization URL for user login
   * @param state A random string to prevent CSRF attacks
   * @param scopes Array of permission scopes to request
   */
  getAuthorizationUrl(
    state: string,
    scopes: string[] = ["playlist-read-private", "playlist-read-collaborative"]
  ): string {
    this.initialize();

    const params = {
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      state: state,
      scope: scopes.join(" "),
    };

    // Construct the URL with query parameters
    const url = new URL("https://accounts.spotify.com/authorize");
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value as string);
    });

    return url.toString();
  }

  /**
   * Exchange an authorization code for access and refresh tokens
   * @param code The authorization code received from Spotify
   */
  async exchangeCodeForTokens(code: string): Promise<UserTokens> {
    this.initialize();

    try {
      const response = await axios({
        method: "post",
        url: "https://accounts.spotify.com/api/token",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(this.clientId + ":" + this.clientSecret).toString(
              "base64"
            ),
        },
        data: querystring.stringify({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: this.redirectUri,
        }),
      });

      const tokens: UserTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: Date.now() + (response.data.expires_in - 60) * 1000,
      };

      // Store the tokens with a user ID (could be from session)
      // For simplicity, we'll use "default" as the user ID in this example
      this.userTokens.set("default", tokens);

      return tokens;
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      throw new Error("Failed to exchange authorization code for tokens");
    }
  }

  /**
   * Refresh the access token using a refresh token
   * @param userId The user ID to refresh the token for
   */
  async refreshAccessToken(userId: string = "default"): Promise<UserTokens> {
    this.initialize();

    const userToken = this.userTokens.get(userId);
    if (!userToken) {
      throw new Error("No refresh token available for this user");
    }

    try {
      const response = await axios({
        method: "post",
        url: "https://accounts.spotify.com/api/token",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(this.clientId + ":" + this.clientSecret).toString(
              "base64"
            ),
        },
        data: querystring.stringify({
          grant_type: "refresh_token",
          refresh_token: userToken.refreshToken,
        }),
      });

      // Update the user's tokens
      const updatedTokens: UserTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || userToken.refreshToken, // Some refreshes don't return a new refresh token
        expiresAt: Date.now() + (response.data.expires_in - 60) * 1000,
      };

      this.userTokens.set(userId, updatedTokens);

      return updatedTokens;
    } catch (error) {
      console.error("Error refreshing access token:", error);
      throw new Error("Failed to refresh access token");
    }
  }

  /**
   * Get a valid user access token, refreshing if necessary
   * @param userId The user ID to get the token for
   */
  async getUserAccessToken(userId: string = "default"): Promise<string> {
    const userToken = this.userTokens.get(userId);

    if (!userToken) {
      throw new Error("User is not authenticated");
    }

    // Check if the token is expired and refresh if needed
    if (Date.now() >= userToken.expiresAt) {
      const refreshedTokens = await this.refreshAccessToken(userId);
      return refreshedTokens.accessToken;
    }

    return userToken.accessToken;
  }

  /**
   * Get user's playlists (requires user authorization)
   * @param userId The user ID to get playlists for
   */
  async getUserPlaylists(
    userId: string = "default",
    limit: number = 50
  ): Promise<any> {
    try {
      const token = await this.getUserAccessToken(userId);

      console.log("Fetching user playlists");
      const response = await axios.get(
        "https://api.spotify.com/v1/me/playlists",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            limit,
          },
        }
      );

      console.log(`Successful response with status: ${response.status}`);
      console.log(`Retrieved ${response.data.items?.length || 0} playlists`);

      return response.data.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        public: item.public,
        images: item.images,
        tracks: {
          total: item.tracks.total,
          href: item.tracks.href,
        },
      }));
    } catch (error) {
      // Enhanced error logging
      if (axios.isAxiosError(error) && error.response) {
        // Log detailed API error response
        console.error("Spotify API error response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else {
        console.error("Error fetching user playlists:", error);
      }
      throw new Error("Failed to fetch user playlists from Spotify API");
    }
  }

  /**
   * Get tracks from a playlist using user authorization
   * @param playlistId The Spotify playlist ID
   * @param userId The user ID to use for authentication
   */
  async getUserPlaylistTracks(
    playlistId: string,
    userId: string = "default"
  ): Promise<SpotifyTrack[]> {
    try {
      const token = await this.getUserAccessToken(userId);
      const tracks: SpotifyTrack[] = [];

      // Use the v1 API with explicit query parameters
      const fields =
        "items(track(id,name,artists(name),album(name),uri,duration_ms)),next";
      let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=${encodeURIComponent(
        fields
      )}&market=US`;

      console.log(
        `Fetching tracks from playlist: ${playlistId} (with user authorization)`
      );
      console.log(`API URL: ${nextUrl}`);

      // Spotify API returns paginated results, so we need to loop until there are no more pages
      while (nextUrl) {
        const response = await axios.get(nextUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Log success response info
        console.log(`Successful response with status: ${response.status}`);
        console.log(`Retrieved ${response.data.items?.length || 0} tracks`);

        // Map response data to our SpotifyTrack interface
        const items = response.data.items.map((item: any) => ({
          id: item.track.id,
          name: item.track.name,
          artists: item.track.artists.map((artist: any) => artist.name),
          album: item.track.album.name,
          uri: item.track.uri,
          duration_ms: item.track.duration_ms,
        }));

        tracks.push(...items);

        // Get next page URL or null if this is the last page
        nextUrl = response.data.next;
      }

      return tracks;
    } catch (error) {
      // Enhanced error logging
      if (axios.isAxiosError(error) && error.response) {
        // Log detailed API error response
        console.error("Spotify API error response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else {
        console.error("Error fetching playlist tracks:", error);
      }
      throw new Error("Failed to fetch playlist tracks from Spotify API");
    }
  }

  /**
   * Get all tracks from a Spotify playlist
   * @param playlistId - Spotify playlist ID
   */
  async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    try {
      const token = await this.getAccessToken();
      const tracks: SpotifyTrack[] = [];

      // First verify the playlist exists by getting its details
      console.log(`Verifying playlist ${playlistId} exists...`);

      try {
        await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            fields: "id,name", // Only request minimal fields to check existence
          },
        });
        console.log(`Playlist ${playlistId} exists, proceeding to get tracks`);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          console.error(`Playlist with ID ${playlistId} not found`);
          throw new Error(`Playlist with ID ${playlistId} not found`);
        }
        throw error; // Re-throw any other errors
      }

      // Use the v1 API with explicit query parameters
      const fields =
        "items(track(id,name,artists(name),album(name),uri,duration_ms)),next";
      let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=${encodeURIComponent(
        fields
      )}&market=US`;

      console.log(`Fetching tracks from playlist: ${playlistId}`);
      console.log(`API URL: ${nextUrl}`);

      // Spotify API returns paginated results, so we need to loop until there are no more pages
      while (nextUrl) {
        const response = await axios.get(nextUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Log success response info
        console.log(`Successful response with status: ${response.status}`);
        console.log(`Retrieved ${response.data.items?.length || 0} tracks`);

        // Map response data to our SpotifyTrack interface
        const items = response.data.items.map((item: any) => ({
          id: item.track.id,
          name: item.track.name,
          artists: item.track.artists.map((artist: any) => artist.name),
          album: item.track.album.name,
          uri: item.track.uri,
          duration_ms: item.track.duration_ms,
        }));

        tracks.push(...items);

        // Get next page URL or null if this is the last page
        nextUrl = response.data.next;
      }

      return tracks;
    } catch (error) {
      // Enhanced error logging
      if (axios.isAxiosError(error) && error.response) {
        // Log detailed API error response
        console.error("Spotify API error response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else {
        console.error("Error fetching playlist tracks:", error);
      }
      throw new Error("Failed to fetch playlist tracks from Spotify API");
    }
  }

  /**
   * Get featured playlists from Spotify
   */
  async getFeaturedPlaylists() {
    try {
      const token = await this.getAccessToken();

      console.log("Fetching featured playlists");
      const response = await axios.get(
        "https://api.spotify.com/v1/browse/featured-playlists",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            limit: 20,
            country: "US",
          },
        }
      );

      console.log(`Successful response with status: ${response.status}`);
      console.log(
        `Retrieved ${response.data.playlists?.items?.length || 0} playlists`
      );

      return response.data.playlists.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        images: item.images,
        tracks: {
          total: item.tracks.total,
          href: item.tracks.href,
        },
      }));
    } catch (error) {
      // Enhanced error logging
      if (axios.isAxiosError(error) && error.response) {
        // Log detailed API error response
        console.error("Spotify API error response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else {
        console.error("Error fetching featured playlists:", error);
      }
      throw new Error("Failed to fetch featured playlists from Spotify API");
    }
  }

  /**
   * Get artist information by ID
   * This should work with client credentials
   */
  async getArtist(artistId: string) {
    try {
      const token = await this.getAccessToken();

      console.log(`Fetching artist with ID: ${artistId}`);
      const response = await axios.get(
        `https://api.spotify.com/v1/artists/${artistId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log(`Successful response with status: ${response.status}`);

      return {
        id: response.data.id,
        name: response.data.name,
        genres: response.data.genres,
        popularity: response.data.popularity,
        images: response.data.images,
        followers: response.data.followers.total,
      };
    } catch (error) {
      // Enhanced error logging
      if (axios.isAxiosError(error) && error.response) {
        // Log detailed API error response
        console.error("Spotify API error response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else {
        console.error("Error fetching artist:", error);
      }
      throw new Error("Failed to fetch artist from Spotify API");
    }
  }

  /**
   * Get new releases - this endpoint should work with client credentials
   */
  async getNewReleases(limit: number = 20) {
    try {
      const token = await this.getAccessToken();

      console.log("Fetching new releases");
      const response = await axios.get(
        "https://api.spotify.com/v1/browse/new-releases",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            limit,
            country: "US",
          },
        }
      );

      console.log(`Successful response with status: ${response.status}`);
      console.log(
        `Retrieved ${response.data.albums?.items?.length || 0} albums`
      );

      return response.data.albums.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        artists: item.artists.map((artist: any) => ({
          id: artist.id,
          name: artist.name,
        })),
        images: item.images,
        release_date: item.release_date,
        total_tracks: item.total_tracks,
      }));
    } catch (error) {
      // Enhanced error logging
      if (axios.isAxiosError(error) && error.response) {
        // Log detailed API error response
        console.error("Spotify API error response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else {
        console.error("Error fetching new releases:", error);
      }
      throw new Error("Failed to fetch new releases from Spotify API");
    }
  }

  /**
   * Create a new playlist for the authenticated user
   * @param name Name of the playlist
   * @param description Description of the playlist
   * @param isPublic Whether the playlist should be public
   */
  async createPlaylist(
    name: string,
    description: string = "",
    isPublic: boolean = false,
    userId: string = "default"
  ): Promise<string> {
    try {
      const token = await this.getUserAccessToken(userId);
      
      // First get the user's Spotify ID
      const userResponse = await axios.get("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const spotifyUserId = userResponse.data.id;
      
      // Create the playlist
      const response = await axios.post(
        `https://api.spotify.com/v1/users/${spotifyUserId}/playlists`,
        {
          name,
          description,
          public: isPublic
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      console.log(`Created playlist: ${name} with ID: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      // Enhanced error logging
      if (axios.isAxiosError(error) && error.response) {
        console.error("Spotify API error response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else {
        console.error("Error creating playlist:", error);
      }
      throw new Error("Failed to create playlist");
    }
  }
  
  /**
   * Search for a track on Spotify
   * @param query Search query string (usually artist and track name)
   */
  async searchTrack(query: string, userId: string = "default"): Promise<string | null> {
    try {
      // Try to use user token if available, fall back to client credentials
      let token;
      try {
        token = await this.getUserAccessToken(userId);
      } catch (error) {
        token = await this.getAccessToken();
      }
      
      const response = await axios.get("https://api.spotify.com/v1/search", {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          q: query,
          type: "track",
          limit: 1
        }
      });
      
      if (response.data.tracks.items.length > 0) {
        return response.data.tracks.items[0].uri;
      }
      
      return null; // No tracks found
    } catch (error) {
      console.error(`Error searching for track "${query}":`, error);
      return null; // Return null instead of throwing to handle gracefully
    }
  }
  
  /**
   * Add tracks to a playlist
   * @param playlistId The Spotify playlist ID
   * @param trackUris Array of Spotify track URIs
   */
  async addTracksToPlaylist(
    playlistId: string,
    trackUris: string[],
    userId: string = "default"
  ): Promise<boolean> {
    try {
      const token = await this.getUserAccessToken(userId);
      
      // Spotify API has a limit of 100 tracks per request
      // So we need to chunk the tracks array
      for (let i = 0; i < trackUris.length; i += 100) {
        const chunk = trackUris.slice(i, i + 100);
        
        await axios.post(
          `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
          {
            uris: chunk
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          }
        );
        
        console.log(`Added ${chunk.length} tracks to playlist ${playlistId}`);
      }
      
      return true;
    } catch (error) {
      // Enhanced error logging
      if (axios.isAxiosError(error) && error.response) {
        console.error("Spotify API error response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else {
        console.error("Error adding tracks to playlist:", error);
      }
      throw new Error("Failed to add tracks to playlist");
    }
  }
}
