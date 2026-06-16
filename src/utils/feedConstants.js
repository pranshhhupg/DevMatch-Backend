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
    "webpack", "vite", "jquery", "redux", "remix", "astro",
    "shadcn", "framer motion",
  ],
  "backend dev": [
    "node", "express", "django", "flask", "fastapi", "spring",
    "laravel", "java", "python", "go", "rust", "php", "ruby",
    "rails", "mongodb", "postgresql", "mysql", "redis", "graphql",
    "bun", "deno", "trpc", "kafka", "rabbitmq",
  ],
  "full stack": [
    "react", "node", "express", "mongodb", "postgresql", "nextjs",
    "vue", "angular", "django", "laravel", "typescript", "javascript",
    "graphql", "trpc",
  ],
  "ml engineer": [
    "python", "tensorflow", "pytorch", "keras", "scikit-learn",
    "pandas", "numpy", "machine learning", "deep learning",
    "nlp", "computer vision", "mlops", "huggingface", "langchain",
    "vector db", "rag", "onnx", "jax",
  ],
  "ai engineer": [
    "openai", "anthropic", "llm", "rag", "langchain", "langgraph",
    "vector db", "pinecone", "weaviate", "chromadb", "huggingface",
    "prompt engineering", "fine-tuning", "agents", "transformers",
    "gpt", "claude api", "embeddings",
  ],
  "prompt engineer": [
    "prompt engineering", "llm", "gpt", "claude", "openai",
    "anthropic", "chain of thought", "few-shot", "rag", "langchain",
    "evaluation", "fine-tuning", "agents", "embeddings",
  ],
  "data scientist": [
    "python", "pandas", "numpy", "scikit-learn", "statistics", "sql",
    "tableau", "power bi", "r", "jupyter", "matplotlib", "seaborn",
    "a/b testing", "data visualization", "spark", "hypothesis testing",
    "machine learning",
  ],
  "data analyst": [
    "sql", "excel", "tableau", "power bi", "python", "pandas",
    "data visualization", "looker", "google analytics", "statistics",
    "a/b testing", "reporting",
  ],
  "designer": [
    "figma", "sketch", "adobe xd", "photoshop", "illustrator",
    "ui", "ux", "prototyping", "design systems", "framer", "canva",
  ],
  "product manager": [
    "product", "roadmap", "agile", "scrum", "jira", "notion",
    "analytics", "user research", "a/b testing", "okr", "figma",
    "trello", "linear",
  ],
  "devops": [
    "docker", "kubernetes", "aws", "gcp", "azure", "terraform",
    "jenkins", "github actions", "linux", "ci/cd", "ansible", "nginx",
    "vault", "istio", "datadog",
  ],
  "mobile dev": [
    "react native", "flutter", "swift", "kotlin", "dart",
    "android", "ios", "expo", "swiftui", "jetpack compose",
  ],
  "qa engineer": [
    "selenium", "cypress", "playwright", "jest", "testing",
    "manual testing", "automation testing", "postman", "junit",
    "appium", "test cases", "qa", "bug tracking", "jira",
  ],
  "blockchain dev": [
    "solidity", "web3", "ethereum", "smart contracts", "hardhat",
    "truffle", "rust", "solana", "ethers.js", "web3.js", "nft",
    "defi", "ipfs",
  ],
  "consultant": [
    "consulting", "strategy", "business analysis", "client management",
    "presentations", "excel", "powerpoint", "stakeholder management",
    "project management", "advisory",
  ],
  "any": [],
};

// Ordered: used for adjacency scoring in experienceLevel
const EXPERIENCE_ORDER = ["beginner", "intermediate", "advanced"];

module.exports = { WEIGHTS, ROLE_SKILL_MAP, EXPERIENCE_ORDER };