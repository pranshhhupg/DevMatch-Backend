const express      = require("express");
const multer       = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { userAuth } = require("../middlewares/auth");

const resumeRouter = express.Router();

// ── Multer: in-memory storage, PDF + DOCX only, max 10 MB ────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Word (.docx) documents are accepted"), false);
    }
  },
});

// ── Gemini client (reads GEMINI_API_KEY from env) ─────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

// ── Enums mirrored from user model ───────────────────────────────────────────
const VALID_LOOKING_FOR = [
  "frontend dev", "backend dev", "full stack", "ml engineer",
  "ai engineer", "prompt engineer", "data scientist", "data analyst",
  "designer", "product manager", "devops", "mobile dev", "qa engineer",
  "blockchain dev", "consultant", "any",
];
const VALID_GOALS = [
  "build a startup", "win hackathons", "learn new tech",
  "open source", "freelance", "get a job",
];
const VALID_AVAILABILITY = ["weekends", "evenings", "full-time", "flexible"];
const VALID_EXPERIENCE   = ["beginner", "intermediate", "advanced"];

// ── Prompt ────────────────────────────────────────────────────────────────────
const PROMPT = `You are a resume parser for DevTinder, a developer networking platform.
Extract structured information from the attached resume and return ONLY valid JSON — no markdown fences, no explanation, no extra text whatsoever.

Return a JSON object matching this exact schema:
{
  "firstName": string,
  "lastName": string,
  "age": number or null,
  "gender": "male" | "female" | "other" | null,
  "about": string (max 300 chars — punchy first-person developer bio summarising their background),
  "skills": string[] (max 20 — only real technical skills: languages, frameworks, tools, platforms),
  "experienceLevel": "beginner" | "intermediate" | "advanced",
  "lookingFor": string[] (subset of: "frontend dev","backend dev","full stack","ml engineer","ai engineer","prompt engineer","data scientist","data analyst","designer","product manager","devops","mobile dev","qa engineer","blockchain dev","consultant","any"),
  "goals": string[] (subset of: "build a startup","win hackathons","learn new tech","open source","freelance","get a job"),
  "availability": "weekends" | "evenings" | "full-time" | "flexible",
  "hackathonInterest": boolean,
  "startupInterest": boolean,
  "learningGoals": string[] (things they are currently learning or want to learn),
  "projectIdeas": string[] (side projects or personal projects mentioned in the resume),
  "timezone": string (IANA timezone string, infer from location/country if present, default "Asia/Kolkata")
}

Inference rules:
- experienceLevel: less than 1 yr total → "beginner", 1–3 yrs → "intermediate", 3+ yrs → "advanced"
- skills: hard/technical skills only — exclude soft skills like "communication" or "teamwork"
- about: write a concise first-person bio from the resume content, max 300 chars
- lookingFor: infer what kind of collaborator this developer would benefit from given their role/domain
- goals: infer from their background, projects, and stated interests
- hackathonInterest: true if any hackathon is mentioned anywhere in the resume
- startupInterest: true if startup work, founding, or startup interest is mentioned
- Never return null for array fields — use [] instead
- Return ONLY the raw JSON object. Nothing else.`;

// ── POST /profile/parse-resume ────────────────────────────────────────────────
resumeRouter.post(
  "/profile/parse-resume",
  userAuth,
  upload.single("resume"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No resume file uploaded" });
      }

      const { buffer, mimetype } = req.file;

      // Gemini inline data part — supports PDF and DOCX directly
      const inlinePart = {
        inlineData: {
          mimeType: mimetype,
          data: buffer.toString("base64"),
        },
      };

      const result = await model.generateContent([PROMPT, inlinePart]);
      const rawText = result.response.text();

      // Strip accidental markdown code fences
      const jsonText = rawText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        console.error("[ResumeParser] Gemini returned non-JSON:\n", rawText);
        return res.status(422).json({
          message: "AI could not extract profile data from this file. Please try a clearer PDF.",
        });
      }

      // ── Sanitise output against user model enums ─────────────────────────
      const sanitized = {
        firstName: typeof parsed.firstName === "string" ? parsed.firstName.trim() : "",
        lastName:  typeof parsed.lastName  === "string" ? parsed.lastName.trim()  : "",
        age: (typeof parsed.age === "number" && parsed.age >= 16 && parsed.age <= 80)
               ? Math.round(parsed.age) : null,
        gender: ["male", "female", "other"].includes(parsed.gender) ? parsed.gender : null,
        about:  typeof parsed.about === "string"
                  ? parsed.about.trim().slice(0, 300) : "",
        skills: Array.isArray(parsed.skills)
                  ? parsed.skills.filter((s) => typeof s === "string").slice(0, 20) : [],
        experienceLevel: VALID_EXPERIENCE.includes(parsed.experienceLevel)
                           ? parsed.experienceLevel : "intermediate",
        lookingFor: Array.isArray(parsed.lookingFor)
                      ? parsed.lookingFor.filter((v) => VALID_LOOKING_FOR.includes(v))
                      : ["any"],
        goals: Array.isArray(parsed.goals)
                 ? parsed.goals.filter((v) => VALID_GOALS.includes(v)) : [],
        availability: VALID_AVAILABILITY.includes(parsed.availability)
                        ? parsed.availability : "flexible",
        hackathonInterest: Boolean(parsed.hackathonInterest),
        startupInterest:   Boolean(parsed.startupInterest),
        learningGoals: Array.isArray(parsed.learningGoals)
                         ? parsed.learningGoals.filter((s) => typeof s === "string") : [],
        projectIdeas: Array.isArray(parsed.projectIdeas)
                        ? parsed.projectIdeas.filter((s) => typeof s === "string") : [],
        timezone: typeof parsed.timezone === "string" && parsed.timezone.trim()
                    ? parsed.timezone.trim() : "Asia/Kolkata",
      };

      if (sanitized.lookingFor.length === 0) sanitized.lookingFor = ["any"];

      return res.json({
        message: "Resume parsed successfully",
        data: sanitized,
      });

    } catch (err) {
      if (err.message?.startsWith("Only PDF")) {
        return res.status(400).json({ message: err.message });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File too large. Maximum size is 10 MB." });
      }
      console.error("[ResumeParser] Error:", err.message);
      return res.status(500).json({ message: "Failed to parse resume: " + err.message });
    }
  }
);

module.exports = resumeRouter;