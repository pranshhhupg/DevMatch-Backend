/**
 * searchHelpers.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralises all search intelligence:
 *   • ROLE_SKILL_MAP   — maps role labels → canonical skill keywords
 *   • QUERY_EXPAND_MAP — maps query tokens → role labels (for NLP-lite expansion)
 *   • expandQuery()    — converts a raw text query into matched skills + intent
 *   • buildSearchQuery() — assembles the final MongoDB filter object
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── 1. Role → Skills mapping ──────────────────────────────────────────────────

const ROLE_SKILL_MAP = {
  "frontend dev": [
    "react", "reactjs", "vue", "vuejs", "angular", "nextjs", "nuxtjs",
    "svelte", "html", "css", "tailwind", "bootstrap", "javascript", "typescript",
    "redux", "gatsby", "webpack", "vite", "sass", "less", "jquery",
    "storybook", "figma", "remix", "astro", "shadcn", "framer motion",
  ],
  "backend dev": [
    "nodejs", "node", "express", "nestjs", "django", "flask", "fastapi",
    "spring", "springboot", "rails", "laravel", "php", "golang", "go",
    "rust", "java", "c#", "dotnet", ".net", "graphql", "rest", "grpc",
    "postgresql", "mysql", "mongodb", "redis", "sqlite", "firebase",
    "supabase", "prisma", "sequelize", "bun", "deno", "trpc", "kafka",
    "rabbitmq",
  ],
  "full stack": [
    "react", "node", "express", "mongodb", "postgresql", "nextjs", "vue",
    "angular", "django", "laravel", "nestjs", "typescript", "javascript",
    "graphql", "rest", "trpc",
  ],
  "ml engineer": [
    "python", "tensorflow", "pytorch", "keras", "sklearn", "scikit-learn",
    "nlp", "opencv", "huggingface", "transformers", "langchain", "llm",
    "deep learning", "machine learning", "data science", "pandas", "numpy",
    "matplotlib", "seaborn", "xgboost", "spark", "hadoop", "airflow",
    "mlops", "cuda", "computer vision", "vector db", "rag", "onnx", "jax",
  ],
  "ai engineer": [
    "python", "sql", "machine learning", "deep learning", "tensorflow",
    "pytorch", "keras", "scikit-learn", "numpy", "pandas", "llm", "gpt",
    "openai", "gemini", "claude", "anthropic", "transformers",
    "huggingface", "prompt engineering", "rag", "embeddings", "vector db",
    "pinecone", "weaviate", "chromadb", "faiss", "langchain", "langgraph",
    "llamaindex", "agents", "crewai", "autogen", "multi-agent",
    "fine-tuning", "lora", "qlora", "fastapi", "flask", "docker",
    "kubernetes", "mlflow", "airflow", "weights & biases", "aws", "gcp",
    "azure", "nlp", "computer vision", "speech recognition",
  ],
  "prompt engineer": [
    "prompt engineering", "llm", "gpt", "claude", "openai", "anthropic",
    "chain of thought", "few-shot", "rag", "langchain", "evaluation",
    "fine-tuning", "agents", "embeddings",
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
  "devops": [
    "docker", "kubernetes", "k8s", "aws", "gcp", "azure", "terraform",
    "ansible", "jenkins", "github actions", "gitlab ci", "ci/cd", "linux",
    "bash", "nginx", "prometheus", "grafana", "helm", "argocd", "pulumi",
    "cloudformation", "ecs", "eks", "vault", "istio", "datadog",
  ],
  "mobile dev": [
    "react native", "flutter", "swift", "swiftui", "kotlin", "android",
    "ios", "dart", "expo", "xamarin", "ionic", "jetpack compose",
  ],
  "designer": [
    "figma", "sketch", "adobe xd", "invision", "zeplin", "ui", "ux",
    "design", "prototyping", "wireframing", "user research", "design system",
    "accessibility", "motion design", "framer",
  ],
  "product manager": [
    "agile", "scrum", "kanban", "jira", "notion", "product", "roadmap",
    "okr", "a/b testing", "analytics", "mixpanel", "amplitude",
    "user stories", "sprint", "stakeholder", "figma", "trello", "linear",
  ],
  "qa engineer": [
    "selenium", "cypress", "playwright", "jest", "testing", "manual testing",
    "automation testing", "postman", "junit", "appium", "test cases", "qa",
    "bug tracking", "jira",
  ],
  "blockchain dev": [
    "solidity", "web3", "ethereum", "smart contracts", "hardhat", "truffle",
    "rust", "solana", "ethers.js", "web3.js", "nft", "defi", "ipfs",
  ],
  "consultant": [
    "consulting", "strategy", "business analysis", "client management",
    "presentations", "excel", "powerpoint", "stakeholder management",
    "project management", "advisory",
  ],
};

// ── 2. Query token → role label (for semantic expansion) ─────────────────────

const QUERY_EXPAND_MAP = {
  // Frontend
  frontend: "frontend dev",
  "front end": "frontend dev",
  "front-end": "frontend dev",
  react: "frontend dev",
  reactjs: "frontend dev",
  vue: "frontend dev",
  vuejs: "frontend dev",
  angular: "frontend dev",
  nextjs: "frontend dev",
  svelte: "frontend dev",
  tailwind: "frontend dev",
  // Backend
  backend: "backend dev",
  "back end": "backend dev",
  "back-end": "backend dev",
  node: "backend dev",
  nodejs: "backend dev",
  express: "backend dev",
  django: "backend dev",
  flask: "backend dev",
  fastapi: "backend dev",
  spring: "backend dev",
  rails: "backend dev",
  laravel: "backend dev",
  golang: "backend dev",
  go: "backend dev",
  // Full Stack
  fullstack: "full stack",
  "full-stack": "full stack",
  "full stack": "full stack",
  mern: "full stack",
  mean: "full stack",
  // ML
  ml: "ml engineer",
  "ml engineer": "ml engineer",
  "machine learning": "ml engineer",
  "deep learning": "ml engineer",
  pytorch: "ml engineer",
  tensorflow: "ml engineer",
  nlp: "ml engineer",
  "computer vision": "ml engineer",
  // AI Engineer
  ai: "ai engineer",
  "ai engineer": "ai engineer",
  llm: "ai engineer",
  rag: "ai engineer",
  langchain: "ai engineer",
  openai: "ai engineer",
  anthropic: "ai engineer",
  gemini: "ai engineer",
  "generative ai": "ai engineer",
  genai: "ai engineer",
  crewai: "ai engineer",
  autogen: "ai engineer",
  "multi-agent": "ai engineer",
  "fine-tuning": "ai engineer",
  llamaindex: "ai engineer",
  // Prompt Engineer
  "prompt engineer": "prompt engineer",
  "prompt engineering": "prompt engineer",
  prompt: "prompt engineer",
  // Data Scientist
  "data science": "data scientist",
  "data scientist": "data scientist",
  python: "data scientist",
  // Data Analyst
  "data analyst": "data analyst",
  "data analytics": "data analyst",
  // QA Engineer
  qa: "qa engineer",
  "qa engineer": "qa engineer",
  "quality assurance": "qa engineer",
  "test engineer": "qa engineer",
  sdet: "qa engineer",
  cypress: "qa engineer",
  selenium: "qa engineer",
  // Blockchain Dev
  blockchain: "blockchain dev",
  "blockchain dev": "blockchain dev",
  "blockchain developer": "blockchain dev",
  web3: "blockchain dev",
  solidity: "blockchain dev",
  ethereum: "blockchain dev",
  crypto: "blockchain dev",
  // Consultant
  consultant: "consultant",
  consulting: "consultant",
  // DevOps
  devops: "devops",
  cloud: "devops",
  docker: "devops",
  kubernetes: "devops",
  k8s: "devops",
  aws: "devops",
  gcp: "devops",
  azure: "devops",
  "site reliability": "devops",
  sre: "devops",
  // Mobile
  mobile: "mobile dev",
  flutter: "mobile dev",
  "react native": "mobile dev",
  ios: "mobile dev",
  android: "mobile dev",
  swift: "mobile dev",
  kotlin: "mobile dev",
  // Designer
  ui: "designer",
  ux: "designer",
  design: "designer",
  designer: "designer",
  figma: "designer",
  // Product
  product: "product manager",
  pm: "product manager",
  "product manager": "product manager",
};

// Special intent keywords (not role-mapped)
const SPECIAL_INTENTS = {
  hackathon: "hackathon",
  "hackathon builders": "hackathon",
  "hackathon builder": "hackathon",
  startup: "startup",
  "startup founders": "startup",
  "startup founder": "startup",
};

// ── 3. Query expansion ─────────────────────────────────────────────────────────

/**
 * Takes a raw search query string and returns:
 *   { expandedSkills, detectedRole, isHackathon, isStartup }
 */
const expandQuery = (rawQuery) => {
  const q = rawQuery.toLowerCase().trim();

  // Check special intents first
  for (const [key, intent] of Object.entries(SPECIAL_INTENTS)) {
    if (q.includes(key)) {
      return {
        expandedSkills: [],
        detectedRole: null,
        isHackathon: intent === "hackathon",
        isStartup: intent === "startup",
      };
    }
  }

  // Exact match in expansion map
  if (QUERY_EXPAND_MAP[q]) {
    const role = QUERY_EXPAND_MAP[q];
    return {
      expandedSkills: ROLE_SKILL_MAP[role] || [],
      detectedRole: role,
      isHackathon: false,
      isStartup: false,
    };
  }

  // Partial / substring match
  for (const [token, role] of Object.entries(QUERY_EXPAND_MAP)) {
    if (q.includes(token)) {
      return {
        expandedSkills: ROLE_SKILL_MAP[role] || [],
        detectedRole: role,
        isHackathon: false,
        isStartup: false,
      };
    }
  }

  return {
    expandedSkills: [],
    detectedRole: null,
    isHackathon: false,
    isStartup: false,
  };
};

// ── 4. Role filter value → MongoDB condition ──────────────────────────────────

const ROLE_FILTER_MAP = {
  frontend:  "frontend dev",
  backend:   "backend dev",
  fullstack: "full stack",
  ml:        "ml engineer",
  ai:        "ai engineer",
  prompt:    "prompt engineer",
  datascientist: "data scientist",
  dataanalyst:   "data analyst",
  devops:    "devops",
  mobile:    "mobile dev",
  designer:  "designer",
  product:   "product manager",
  qa:        "qa engineer",
  blockchain: "blockchain dev",
  consultant: "consultant",
};

// ── 5. Availability filter value → MongoDB condition ─────────────────────────

const AVAILABILITY_FILTER_MAP = {
  weekends:  { availability: "weekends" },
  evenings:  { availability: "evenings" },
  fulltime:  { availability: "full-time" },
  flexible:  { availability: "flexible" },
  hackathon: { hackathonInterest: true },
  startup:   { startupInterest: true },
};

// ── 6. Main query builder ─────────────────────────────────────────────────────

/**
 * Builds the MongoDB query object from search params.
 *
 * @param {object}   params
 * @param {string}   params.q              - Free-text search query
 * @param {string}   params.role           - Role filter value (see ROLE_FILTER_MAP keys)
 * @param {string}   params.availability   - Availability filter value
 * @param {ObjectId} params.loggedInUserId
 * @param {Set}      params.excludedIds    - IDs of users to always exclude (self + interacted)
 * @returns {object} MongoDB filter
 */
const buildSearchQuery = ({
  q,
  role,
  availability,
  loggedInUserId,
  excludedIds,
}) => {
  const andConditions = [];

  // ── Always exclude self + interacted users ───────────────────────────────
  const excluded = excludedIds
    ? Array.from(excludedIds)
    : [loggedInUserId.toString()];

  const base = {
    _id: { $nin: excluded },
  };

  // ── A. Free-text search ──────────────────────────────────────────────────
  if (q && q.trim()) {
    const raw = q.trim();

    const {
      expandedSkills,
      detectedRole,
      isHackathon,
      isStartup,
    } = expandQuery(raw);

    const orClauses = [];

    // Name search
    orClauses.push({
      firstName: { $regex: raw, $options: "i" },
    });

    orClauses.push({
      lastName: { $regex: raw, $options: "i" },
    });

    // About search
    orClauses.push({
      about: { $regex: raw, $options: "i" },
    });

    // Skills search
    orClauses.push({
      skills: { $regex: raw, $options: "i" },
    });

    // Goals search
    orClauses.push({
      goals: { $regex: raw, $options: "i" },
    });

    // Looking for search
    orClauses.push({
      lookingFor: { $regex: raw, $options: "i" },
    });

    // Learning goals search
    orClauses.push({
      learningGoals: { $regex: raw, $options: "i" },
    });

    // Expanded semantic skills
    if (expandedSkills.length > 0) {
      const skillRegexes = expandedSkills.map(
        (s) => new RegExp(s, "i")
      );

      orClauses.push({
        skills: { $in: skillRegexes },
      });
    }

    // Detected role
    if (detectedRole) {
      orClauses.push({
        lookingFor: {
          $regex: detectedRole,
          $options: "i",
        },
      });
    }

    // Special intents
    if (isHackathon) {
      orClauses.push({
        hackathonInterest: true,
      });
    }

    if (isStartup) {
      orClauses.push({
        startupInterest: true,
      });
    }

    andConditions.push({
      $or: orClauses,
    });
  }

  // ── B. Role filter ───────────────────────────────────────────────────────
  if (
    role &&
    role !== "all" &&
    ROLE_FILTER_MAP[role]
  ) {
    const mappedRole = ROLE_FILTER_MAP[role];

    const roleSkills =
      ROLE_SKILL_MAP[mappedRole] || [];

    const roleClauses = [
      {
        lookingFor: {
          $regex: mappedRole,
          $options: "i",
        },
      },
    ];

    if (roleSkills.length > 0) {
      roleClauses.push({
        skills: {
          $in: roleSkills.map(
            (s) => new RegExp(s, "i")
          ),
        },
      });
    }

    andConditions.push({
      $or: roleClauses,
    });
  }

  // ── C. Availability filter ───────────────────────────────────────────────
  if (
    availability &&
    availability !== "all" &&
    AVAILABILITY_FILTER_MAP[availability]
  ) {
    andConditions.push(
      AVAILABILITY_FILTER_MAP[availability]
    );
  }

  // ── Final Query ──────────────────────────────────────────────────────────
  if (andConditions.length === 0) {
    return base;
  }

  return {
    ...base,
    $and: andConditions,
  };
};

module.exports = {
  buildSearchQuery,
  expandQuery,
  ROLE_SKILL_MAP,
  ROLE_FILTER_MAP,
  AVAILABILITY_FILTER_MAP,
};