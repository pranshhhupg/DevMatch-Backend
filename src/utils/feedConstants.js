/**
 * Central config for feed scoring.
 * Tweak weights or add new roles here — nowhere else.
 * Weights must always sum to 100.
 */

const WEIGHTS = {
    lookingFor:      35,
    skills:          25,
    goals:           15,
    timezone:         8,
    experienceLevel:  7,
    interests:        5,   // hackathon + startup combined
    projects:         5,
  };
  // 35 + 25 + 15 + 8 + 7 + 5 + 5 = 100 ✓
  
  /**
   * Maps each lookingFor role to its canonical skill keywords.
   * Matching is substring-based, so "react" matches "ReactJS", "react native" etc.
   */
  const ROLE_SKILL_MAP = {
    "frontend dev": [
      "react", "angular", "vue", "svelte", "html", "css", "sass",
      "javascript", "typescript", "nextjs", "nuxt", "tailwind",
      "webpack", "vite", "jquery", "redux",
    ],
    "backend dev": [
      "node", "express", "django", "flask", "fastapi", "spring",
      "laravel", "java", "python", "go", "rust", "php", "ruby",
      "rails", "mongodb", "postgresql", "mysql", "redis", "graphql",
    ],
    "ml engineer": [
      "python", "tensorflow", "pytorch", "keras", "scikit-learn",
      "pandas", "numpy", "machine learning", "deep learning",
      "nlp", "computer vision", "mlops", "huggingface", "langchain",
    ],
    "designer": [
      "figma", "sketch", "adobe xd", "photoshop", "illustrator",
      "ui", "ux", "prototyping", "design systems", "framer", "canva",
    ],
    "product manager": [
      "product", "roadmap", "agile", "scrum", "jira", "notion",
      "analytics", "user research", "a/b testing", "okr",
    ],
    "devops": [
      "docker", "kubernetes", "aws", "gcp", "azure", "terraform",
      "jenkins", "github actions", "linux", "ci/cd", "ansible", "nginx",
    ],
    "mobile dev": [
      "react native", "flutter", "swift", "kotlin", "dart",
      "android", "ios", "expo",
    ],
    "any": [],
  };
  
  // Ordered: used for adjacency scoring in experienceLevel
  const EXPERIENCE_ORDER = ["beginner", "intermediate", "advanced"];
  
  module.exports = { WEIGHTS, ROLE_SKILL_MAP, EXPERIENCE_ORDER };