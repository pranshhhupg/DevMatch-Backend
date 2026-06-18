const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { userAuth } = require("../middlewares/auth");

const bioRouter = express.Router();

// ── Gemini client ─────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

// ── Action definitions ────────────────────────────────────────────────────────
const ACTIONS = {
  generate: "generate",
  rephrase: "rephrase",
  concise: "concise",
  expand: "expand",
  professional: "professional",
  casual: "casual",
};

// ── Build the prompt based on action + profile context ───────────────────────
function buildPrompt(action, context, currentBio) {
  const {
    firstName = "", lastName = "",
    skills = [], experienceLevel = "",
    goals = [], lookingFor = [],
    hackathonInterest = false, startupInterest = false,
    availability = "", learningGoals = [], projectIdeas = [],
  } = context;

  const profileSummary = [
    firstName && `Name: ${firstName} ${lastName}`.trim(),
    experienceLevel && `Experience: ${experienceLevel}`,
    skills.length     && `Skills: ${skills.join(", ")}`,
    goals.length      && `Goals: ${goals.join(", ")}`,
    lookingFor.length && `Looking for: ${lookingFor.join(", ")}`,
    availability      && `Availability: ${availability}`,
    hackathonInterest && "Interested in hackathons",
    startupInterest   && "Interested in startups",
    learningGoals.length && `Learning: ${learningGoals.join(", ")}`,
    projectIdeas.length  && `Projects: ${projectIdeas.join(", ")}`,
  ].filter(Boolean).join("\n");

  const BASE_RULES = `
Rules:
- Write in first person
- Maximum 300 characters — this is a hard limit, count carefully
- No hashtags, no emojis, no markdown
- Return ONLY the bio text — no explanation, no quotes, no preamble
- Make it feel authentic, not corporate`.trim();

  const prompts = {
    generate: `You are writing a developer bio for DevTinder, a platform where developers find collaborators.

Profile context:
${profileSummary || "No profile data provided yet."}

Write a punchy, engaging first-person developer bio for this person based on their profile data.
${BASE_RULES}`,

    rephrase: `You are improving a developer bio for DevTinder.

Current bio:
"${currentBio}"

Profile context:
${profileSummary}

Rephrase this bio — keep the same meaning and facts, but use different wording to make it fresher and more engaging.
${BASE_RULES}`,

    concise: `You are improving a developer bio for DevTinder.

Current bio:
"${currentBio}"

Profile context:
${profileSummary}

Rewrite this bio to be shorter and more punchy. Cut filler words, keep only the most impactful information. Aim for under 150 characters if possible, never exceed 300.
${BASE_RULES}`,

    expand: `You are improving a developer bio for DevTinder.

Current bio:
"${currentBio}"

Profile context:
${profileSummary}

Expand this bio by naturally weaving in more relevant details from the profile context. Make it richer and more complete while staying under 300 characters.
${BASE_RULES}`,

    professional: `You are improving a developer bio for DevTinder.

Current bio:
"${currentBio}"

Profile context:
${profileSummary}

Rewrite this bio in a professional, confident tone — like a polished LinkedIn summary. Keep it first person but authoritative.
${BASE_RULES}`,

    casual: `You are improving a developer bio for DevTinder.

Current bio:
"${currentBio}"

Profile context:
${profileSummary}

Rewrite this bio in a casual, friendly, conversational tone — like how a developer would introduce themselves to a peer at a hackathon. Keep it genuine and approachable.
${BASE_RULES}`,
  };

  return prompts[action] || prompts.generate;
}

// ── POST /profile/generate-bio ────────────────────────────────────────────────
bioRouter.post("/profile/generate-bio", userAuth, async (req, res) => {
  try {
    const { action, context = {}, currentBio = "" } = req.body;

    if (!ACTIONS[action]) {
      return res.status(400).json({
        message: `Invalid action. Must be one of: ${Object.keys(ACTIONS).join(", ")}`,
      });
    }

    // For actions that need existing bio, validate it exists
    const requiresBio = ["rephrase", "concise", "expand", "professional", "casual"];
    if (requiresBio.includes(action) && !currentBio?.trim()) {
      return res.status(400).json({
        message: "A current bio is required for this action. Write something first, then use this action.",
      });
    }

    const prompt = buildPrompt(action, context, currentBio);
    const result = await model.generateContent(prompt);
    let bio = result.response.text().trim();

    // Strip any quotes the model may have wrapped around it
    bio = bio.replace(/^["']|["']$/g, "").trim();

    // Hard-enforce 300 char limit
    if (bio.length > 300) {
      bio = bio.slice(0, 297) + "...";
    }

    return res.json({
      message: "Bio generated successfully",
      data: { bio },
    });
  } catch (err) {
    console.error("[BioGenerator] Error:", err.message);
    return res.status(500).json({ message: "Failed to generate bio: " + err.message });
  }
});

module.exports = bioRouter;