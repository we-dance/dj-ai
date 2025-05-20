import { Router, Request, Response } from "express";
import { ProviderFactory } from "../llm/providerFactory";
import { PromptBuilder } from "../utils/promptBuilder";
import axios from "axios";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { venue, date, style, useSpotifyLibrary, playlistId } = req.body;

    if (!venue || !date || !style) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: venue, date, and style are required",
      });
    }

    // If a playlist ID is provided, use that specific playlist
    if (playlistId) {
      try {
        console.log(`Using provided playlist ID ${playlistId} for generation`);
        const response = await axios.post(
          `${req.protocol}://${req.get('host')}/spotify/generate-from-playlist`,
          { venue, date, style, playlistId },
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        return res.status(200).json(response.data);
      } catch (spotifyError) {
        console.error("Error generating playlist from user playlist:", spotifyError);
        
        // If the Spotify endpoint fails, fall back to the regular prompt
        console.log("Falling back to regular prompt generation");
      }
    }
    // If useSpotifyLibrary is true, use the library playlist
    else if (useSpotifyLibrary) {
      try {
        console.log("Using Spotify library for playlist generation");
        // Call our consolidated endpoint without a playlist ID
        const response = await axios.post(
          `${req.protocol}://${req.get('host')}/spotify/generate-from-playlist`,
          { venue, date, style },
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        return res.status(200).json(response.data);
      } catch (spotifyError) {
        console.error("Error generating playlist with Spotify library:", spotifyError);
        
        // If the Spotify endpoint fails, fall back to the regular prompt
        console.log("Falling back to regular prompt generation");
      }
    }

    // Regular prompt generation using hardcoded library
    const prompt = PromptBuilder.buildPrompt(venue, date, style);

    const provider = ProviderFactory.getProvider();

    console.log(
      `Generating playlist for venue: ${venue}, date: ${date}, style: ${style}`
    );
    const playlist = await provider.generate(prompt);

    return res.status(200).json({
      success: true,
      data: {
        playlist,
        provider: process.env.LLM_PROVIDER || "gemini",
        inputs: { venue, date, style },
        usingSpotifyLibrary: false
      },
    });
  } catch (error) {
    console.error("Error generating playlist:", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});

export default router;
