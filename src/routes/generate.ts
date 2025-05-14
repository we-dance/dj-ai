import { Router, Request, Response } from "express";
import { ProviderFactory } from "../llm/providerFactory";
import { PromptBuilder } from "../utils/promptBuilder";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { venue, date, style } = req.body;

    if (!venue || !date || !style) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: venue, date, and style are required",
      });
    }

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
