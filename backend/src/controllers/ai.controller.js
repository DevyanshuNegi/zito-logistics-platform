import { getAIResponse } from "../services/ai.service.js";

export const chatWithAI = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const reply = await getAIResponse(message);

    return res.status(200).json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error("CONTROLLER ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};