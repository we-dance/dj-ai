import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import generateRoutes from "./routes/generate";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/generate", generateRoutes);

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
    ],
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Active LLM provider: ${process.env.LLM_PROVIDER || "gemini (default)"}`
  );
});
