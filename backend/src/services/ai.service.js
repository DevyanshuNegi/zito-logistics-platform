import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const getAIResponse = async (message) => {
  try {
    if (!message) return "Please enter a message.";

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are ZITO logistics assistant.

Rules:
- Keep answers short
- Help with booking, pricing, tracking
- If unsure, say "Please contact support"
          `,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.5,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("AI ERROR:", error.message);
    return "AI service unavailable.";
  }
};