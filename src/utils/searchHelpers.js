/**
 * searchHelpers.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralises all search intelligence:
 *   • ROLE_SKILL_MAP   — maps role labels → canonical skill keywords
 *   • QUERY_EXPAND_MAP — maps query tokens → role labels (NLP-lite expansion)
 *   • expandQuery()    — converts a raw text query into matched skills + intent
 *   • buildSearchQuery() — assembles the final MongoDB filter object
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── 1. Role → Skills mapping ──────────────────────────────────────────────────

const ROLE_SKILL_MAP = {
  "frontend dev": [
    "html", "html5", "css", "css3", "scss", "sass", "less",
    "javascript", "typescript", "es6", "es7", "react", "reactjs",
    "nextjs", "next.js", "gatsby", "remix", "vue", "vuejs", "nuxtjs",
    "angular", "svelte", "astro", "solidjs", "jquery",
    "redux", "zustand", "mobx", "recoil", "context api",
    "tailwind", "bootstrap", "material ui", "mui", "chakra ui",
    "ant design", "shadcn", "framer motion", "storybook",
    "webpack", "vite", "parcel", "babel",
    "responsive design", "web accessibility", "seo",
    "pwa", "websocket", "graphql", "rest api", "axios",
    "react query", "tanstack query", "swr",
    "jest", "vitest", "cypress", "playwright",
    "figma", "ui", "ux", "frontend architecture",
  ],

  "backend dev": [
    "node", "nodejs", "express", "nestjs", "fastify", "hapi",
    "python", "django", "flask", "fastapi",
    "java", "spring", "springboot",
    "c#", ".net", "dotnet", "asp.net",
    "php", "laravel", "symfony",
    "ruby", "rails",
    "go", "golang",
    "rust",
    "graphql", "rest", "rest api", "grpc",
    "microservices", "event driven architecture",
    "postgresql", "mysql", "mongodb", "redis",
    "sqlite", "cassandra", "dynamodb",
    "firebase", "supabase",
    "prisma", "typeorm", "sequelize", "mongoose",
    "kafka", "rabbitmq", "sqs",
    "docker", "kubernetes",
    "jwt", "oauth", "authentication", "authorization",
    "api design", "system design", "websocket",
    "serverless", "cron jobs", "caching",
  ],

  "full stack": [
    "html", "css", "javascript", "typescript",
    "react", "reactjs", "nextjs", "next.js",
    "vue", "angular", "redux", "tailwind",
    "node", "nodejs", "express", "nestjs",
    "django", "flask", "laravel",
    "mongodb", "mongoose",
    "mysql", "postgresql", "redis",
    "graphql", "rest api",
    "firebase", "supabase",
    "docker", "aws",
    "prisma", "sequelize", "typeorm",
    "jwt", "oauth",
    "system design", "api integration",
    "websocket",
  ],

  "ml engineer": [
    "python", "tensorflow", "pytorch", "keras",
    "sklearn", "scikit-learn",
    "numpy", "pandas",
    "matplotlib", "seaborn", "plotly",
    "xgboost", "lightgbm", "catboost",
    "machine learning", "deep learning",
    "supervised learning", "unsupervised learning",
    "reinforcement learning",
    "feature engineering",
    "model deployment",
    "computer vision", "opencv",
    "nlp", "transformers", "huggingface",
    "spark", "hadoop", "airflow",
    "mlops", "onnx", "cuda", "jax",
    "rag", "vector db",
    "statistics", "probability",
  ],

  "ai engineer": [
    "python", "sql",
    "machine learning", "deep learning",
    "tensorflow", "pytorch", "keras",
    "scikit-learn", "numpy", "pandas",
    "llm", "gpt", "openai", "gemini", "claude",
    "anthropic", "transformers", "huggingface",
    "prompt engineering",
    "rag", "embeddings",
    "vector db", "vector database",
    "pinecone", "weaviate", "chromadb", "faiss", "milvus",
    "langchain", "langgraph", "llamaindex",
    "agents", "multi-agent", "autogen", "crewai",
    "fine tuning", "lora", "qlora",
    "fastapi", "flask",
    "docker", "kubernetes",
    "mlflow", "weights & biases", "wandb",
    "aws", "azure", "gcp",
    "nlp", "computer vision",
    "speech recognition",
    "generative ai", "agentic ai",
  ],

  "prompt engineer": [
    "prompt engineering",
    "llm", "gpt", "claude", "openai", "anthropic",
    "gemini", "transformers",
    "few-shot prompting",
    "zero-shot prompting",
    "chain of thought",
    "cot",
    "rag",
    "evaluation",
    "fine tuning",
    "embeddings",
    "agents",
    "langchain",
    "langgraph",
    "llamaindex",
    "prompt optimization",
    "prompt testing",
  ],

  "data scientist": [
    "python", "r", "sql",
    "statistics", "probability",
    "hypothesis testing",
    "a/b testing",
    "machine learning",
    "data mining",
    "data analysis",
    "data visualization",
    "predictive modeling",
    "pandas", "numpy",
    "matplotlib", "seaborn", "plotly",
    "tableau", "power bi",
    "jupyter", "excel",
    "scikit-learn",
    "feature engineering",
  ],

  "data analyst": [
    "sql", "excel", "google sheets",
    "power bi", "tableau",
    "looker", "looker studio",
    "data visualization",
    "dashboarding",
    "reporting",
    "business intelligence",
    "statistics",
    "python", "pandas",
    "a/b testing",
    "google analytics",
    "data cleaning",
    "data analysis",
    "etl",
  ],

  "devops": [
    "docker", "kubernetes", "k8s",
    "terraform", "ansible", "pulumi",
    "jenkins", "github actions",
    "gitlab ci", "circleci",
    "aws", "azure", "gcp",
    "linux", "bash", "shell scripting",
    "nginx", "apache",
    "helm", "argocd",
    "prometheus", "grafana",
    "datadog", "elk stack",
    "ci/cd", "iac",
    "monitoring", "logging",
    "cloudformation",
    "ecs", "eks",
  ],

  "mobile dev": [
    "react native", "flutter",
    "swift", "swiftui",
    "kotlin", "android",
    "ios", "dart",
    "expo", "ionic",
    "xamarin",
    "jetpack compose",
    "firebase",
    "realm",
    "mobile ui",
    "mobile architecture",
    "play store deployment",
    "app store deployment",
  ],

  "designer": [
    "figma", "sketch", "adobe xd",
    "invision", "zeplin",
    "ui", "ux",
    "design", "prototyping",
    "wireframing",
    "user research",
    "design system",
    "accessibility",
    "motion design",
    "framer",
    "interaction design",
    "usability testing",
    "visual design",
    "information architecture",
  ],

  "product manager": [
    "agile", "scrum", "kanban",
    "jira", "notion", "trello", "linear",
    "product management",
    "roadmap", "okr",
    "analytics",
    "mixpanel", "amplitude",
    "a/b testing",
    "user stories",
    "stakeholder management",
    "sprint planning",
    "product strategy",
    "market research",
    "requirement gathering",
    "prioritization",
  ],

  "qa engineer": [
    "selenium", "cypress",
    "playwright", "appium",
    "jest", "vitest",
    "junit", "testng",
    "testing",
    "manual testing",
    "automation testing",
    "api testing",
    "postman", "swagger",
    "load testing",
    "performance testing",
    "regression testing",
    "integration testing",
    "unit testing",
    "jira",
    "bug tracking",
    "test cases",
  ],

  "blockchain dev": [
    "solidity", "ethereum",
    "web3", "web3.js", "ethers.js",
    "smart contracts",
    "hardhat", "truffle",
    "solana", "rust",
    "defi", "dao",
    "ipfs",
    "polygon",
    "avalanche",
    "nft",
    "tokenomics",
    "blockchain architecture",
  ],

  "consultant": [
    "consulting",
    "strategy",
    "business analysis",
    "client management",
    "presentations",
    "excel",
    "powerpoint",
    "stakeholder management",
    "project management",
    "advisory",
    "problem solving",
    "market research",
    "financial modeling",
    "business strategy",
  ],
};

// ── 2. Query token → role label (for semantic expansion) ──────────────────────
//
// Each token is a keyword a user might type. Long/multi-word phrases are tested
// before short ones (sort by descending length) so "react native" beats "react".

const QUERY_EXPAND_MAP = {
  // ── Frontend ──────────────────────────────────────────────────────────────
  "frontend dev":        "frontend dev",
  "front end developer": "frontend dev",
  "frontend developer":  "frontend dev",
  "front-end developer": "frontend dev",
  "frontend engineer":   "frontend dev",
  "front end":           "frontend dev",
  "front-end":           "frontend dev",
  frontend:              "frontend dev",
  reactjs:               "frontend dev",
  "next.js":             "frontend dev",
  nextjs:                "frontend dev",
  nuxtjs:                "frontend dev",
  solidjs:               "frontend dev",
  "framer motion":       "frontend dev",
  "tanstack query":      "frontend dev",
  "react query":         "frontend dev",
  "context api":         "frontend dev",
  "web accessibility":   "frontend dev",
  "responsive design":   "frontend dev",
  "frontend architecture": "frontend dev",
  storybook:             "frontend dev",
  "material ui":         "frontend dev",
  "chakra ui":           "frontend dev",
  "ant design":          "frontend dev",
  "shadcn":              "frontend dev",
  gatsby:                "frontend dev",
  remix:                 "frontend dev",
  astro:                 "frontend dev",
  svelte:                "frontend dev",
  angular:               "frontend dev",
  vuejs:                 "frontend dev",
  vue:                   "frontend dev",
  react:                 "frontend dev",
  redux:                 "frontend dev",
  zustand:               "frontend dev",
  tailwind:              "frontend dev",
  bootstrap:             "frontend dev",
  webpack:               "frontend dev",
  vite:                  "frontend dev",
  parcel:                "frontend dev",
  babel:                 "frontend dev",
  scss:                  "frontend dev",
  sass:                  "frontend dev",
  html5:                 "frontend dev",
  html:                  "frontend dev",
  css3:                  "frontend dev",
  css:                   "frontend dev",
  jquery:                "frontend dev",
  pwa:                   "frontend dev",
  swr:                   "frontend dev",
  vitest:                "frontend dev",

  // ── Backend ───────────────────────────────────────────────────────────────
  "backend dev":         "backend dev",
  "backend developer":   "backend dev",
  "back-end developer":  "backend dev",
  "backend engineer":    "backend dev",
  "back end":            "backend dev",
  "back-end":            "backend dev",
  backend:               "backend dev",
  "event driven architecture": "backend dev",
  "api design":          "backend dev",
  "system design":       "backend dev",
  "asp.net":             "backend dev",
  springboot:            "backend dev",
  nestjs:                "backend dev",
  fastapi:               "backend dev",
  fastify:               "backend dev",
  express:               "backend dev",
  laravel:               "backend dev",
  symfony:               "backend dev",
  django:                "backend dev",
  flask:                 "backend dev",
  rails:                 "backend dev",
  golang:                "backend dev",
  dotnet:                "backend dev",
  ".net":                "backend dev",
  java:                  "backend dev",
  spring:                "backend dev",
  ruby:                  "backend dev",
  php:                   "backend dev",
  rust:                  "backend dev",
  go:                    "backend dev",
  grpc:                  "backend dev",
  microservices:         "backend dev",
  postgresql:            "backend dev",
  mysql:                 "backend dev",
  mongodb:               "backend dev",
  redis:                 "backend dev",
  sqlite:                "backend dev",
  cassandra:             "backend dev",
  dynamodb:              "backend dev",
  supabase:              "backend dev",
  firebase:              "backend dev",
  prisma:                "backend dev",
  typeorm:               "backend dev",
  sequelize:             "backend dev",
  mongoose:              "backend dev",
  kafka:                 "backend dev",
  rabbitmq:              "backend dev",
  sqs:                   "backend dev",
  serverless:            "backend dev",
  caching:               "backend dev",
  jwt:                   "backend dev",
  oauth:                 "backend dev",
  authentication:        "backend dev",
  authorization:         "backend dev",

  // ── Full Stack ────────────────────────────────────────────────────────────
  "full stack developer":  "full stack",
  "fullstack developer":   "full stack",
  "full-stack developer":  "full stack",
  "full stack engineer":   "full stack",
  "full-stack":            "full stack",
  "full stack":            "full stack",
  fullstack:               "full stack",
  mern:                    "full stack",
  mean:                    "full stack",
  mevn:                    "full stack",
  "api integration":       "full stack",

  // ── ML Engineer ───────────────────────────────────────────────────────────
  "ml engineer":           "ml engineer",
  "machine learning engineer": "ml engineer",
  "machine learning":      "ml engineer",
  "deep learning":         "ml engineer",
  "supervised learning":   "ml engineer",
  "unsupervised learning":  "ml engineer",
  "reinforcement learning": "ml engineer",
  "feature engineering":   "ml engineer",
  "model deployment":      "ml engineer",
  "computer vision":       "ml engineer",
  "vector db":             "ml engineer",
  "scikit-learn":          "ml engineer",
  lightgbm:                "ml engineer",
  catboost:                "ml engineer",
  xgboost:                 "ml engineer",
  tensorflow:              "ml engineer",
  pytorch:                 "ml engineer",
  keras:                   "ml engineer",
  sklearn:                 "ml engineer",
  huggingface:             "ml engineer",
  transformers:            "ml engineer",
  langchain:               "ml engineer",
  mlops:                   "ml engineer",
  opencv:                  "ml engineer",
  hadoop:                  "ml engineer",
  airflow:                 "ml engineer",
  spark:                   "ml engineer",
  cuda:                    "ml engineer",
  onnx:                    "ml engineer",
  jax:                     "ml engineer",
  rag:                     "ml engineer",
  nlp:                     "ml engineer",
  matplotlib:              "ml engineer",
  seaborn:                 "ml engineer",
  plotly:                  "ml engineer",
  numpy:                   "ml engineer",
  pandas:                  "ml engineer",

  // ── AI Engineer ───────────────────────────────────────────────────────────
  "ai engineer":           "ai engineer",
  "artificial intelligence engineer": "ai engineer",
  "generative ai":         "ai engineer",
  "agentic ai":            "ai engineer",
  "vector database":       "ai engineer",
  "multi-agent":           "ai engineer",
  "fine tuning":           "ai engineer",
  "speech recognition":    "ai engineer",
  "prompt engineering":    "ai engineer",
  "weights & biases":      "ai engineer",
  llamaindex:              "ai engineer",
  langgraph:               "ai engineer",
  chromadb:                "ai engineer",
  weaviate:                "ai engineer",
  pinecone:                "ai engineer",
  milvus:                  "ai engineer",
  faiss:                   "ai engineer",
  embeddings:              "ai engineer",
  autogen:                 "ai engineer",
  crewai:                  "ai engineer",
  agents:                  "ai engineer",
  wandb:                   "ai engineer",
  mlflow:                  "ai engineer",
  lora:                    "ai engineer",
  qlora:                   "ai engineer",
  anthropic:               "ai engineer",
  openai:                  "ai engineer",
  gemini:                  "ai engineer",
  claude:                  "ai engineer",
  genai:                   "ai engineer",
  gpt:                     "ai engineer",
  llm:                     "ai engineer",
  ai:                      "ai engineer",

  // ── Prompt Engineer ───────────────────────────────────────────────────────
  "prompt engineer":       "prompt engineer",
  "few-shot prompting":    "prompt engineer",
  "zero-shot prompting":   "prompt engineer",
  "chain of thought":      "prompt engineer",
  "prompt optimization":   "prompt engineer",
  "prompt testing":        "prompt engineer",
  "few-shot":              "prompt engineer",
  "zero-shot":             "prompt engineer",
  cot:                     "prompt engineer",
  evaluation:              "prompt engineer",
  prompt:                  "prompt engineer",

  // ── Data Scientist ────────────────────────────────────────────────────────
  "data scientist":        "data scientist",
  "data science":          "data scientist",
  "hypothesis testing":    "data scientist",
  "predictive modeling":   "data scientist",
  "data visualization":    "data scientist",
  "data mining":           "data scientist",
  "data analysis":         "data scientist",
  "a/b testing":           "data scientist",
  probability:             "data scientist",
  statistics:              "data scientist",
  "power bi":              "data scientist",
  tableau:                 "data scientist",
  jupyter:                 "data scientist",
  excel:                   "data analyst",   // ambiguous — defaults to analyst

  // ── Data Analyst ──────────────────────────────────────────────────────────
  "data analyst":          "data analyst",
  "data analytics":        "data analyst",
  "business intelligence": "data analyst",
  "looker studio":         "data analyst",
  "google analytics":      "data analyst",
  "data cleaning":         "data analyst",
  dashboarding:            "data analyst",
  reporting:               "data analyst",
  looker:                  "data analyst",
  etl:                     "data analyst",
  sql:                     "data analyst",

  // ── DevOps ────────────────────────────────────────────────────────────────
  "devops engineer":       "devops",
  "site reliability":      "devops",
  "shell scripting":       "devops",
  "github actions":        "devops",
  "gitlab ci":             "devops",
  "elk stack":             "devops",
  cloudformation:          "devops",
  monitoring:              "devops",
  logging:                 "devops",
  circleci:                "devops",
  terraform:               "devops",
  ansible:                 "devops",
  jenkins:                 "devops",
  kubernetes:              "devops",
  docker:                  "devops",
  prometheus:              "devops",
  grafana:                 "devops",
  datadog:                 "devops",
  argocd:                  "devops",
  pulumi:                  "devops",
  nginx:                   "devops",
  apache:                  "devops",
  helm:                    "devops",
  "ci/cd":                 "devops",
  iac:                     "devops",
  k8s:                     "devops",
  aws:                     "devops",
  gcp:                     "devops",
  azure:                   "devops",
  ecs:                     "devops",
  eks:                     "devops",
  linux:                   "devops",
  bash:                    "devops",
  cloud:                   "devops",
  sre:                     "devops",
  devops:                  "devops",

  // ── Mobile Dev ────────────────────────────────────────────────────────────
  "mobile developer":      "mobile dev",
  "mobile engineer":       "mobile dev",
  "react native":          "mobile dev",
  "jetpack compose":       "mobile dev",
  "mobile architecture":   "mobile dev",
  "mobile ui":             "mobile dev",
  "play store deployment": "mobile dev",
  "app store deployment":  "mobile dev",
  swiftui:                 "mobile dev",
  flutter:                 "mobile dev",
  xamarin:                 "mobile dev",
  android:                 "mobile dev",
  kotlin:                  "mobile dev",
  swift:                   "mobile dev",
  expo:                    "mobile dev",
  ionic:                   "mobile dev",
  dart:                    "mobile dev",
  realm:                   "mobile dev",
  mobile:                  "mobile dev",
  ios:                     "mobile dev",

  // ── Designer ──────────────────────────────────────────────────────────────
  "ux designer":           "designer",
  "ui designer":           "designer",
  "ui/ux designer":        "designer",
  "design system":         "designer",
  "user research":         "designer",
  "interaction design":    "designer",
  "motion design":         "designer",
  "usability testing":     "designer",
  "visual design":         "designer",
  "information architecture": "designer",
  "adobe xd":              "designer",
  wireframing:             "designer",
  prototyping:             "designer",
  invision:                "designer",
  zeplin:                  "designer",
  framer:                  "designer",
  figma:                   "designer",
  sketch:                  "designer",
  accessibility:           "designer",
  designer:                "designer",
  design:                  "designer",
  ux:                      "designer",
  ui:                      "designer",

  // ── Product Manager ───────────────────────────────────────────────────────
  "product manager":       "product manager",
  "product management":    "product manager",
  "product owner":         "product manager",
  "sprint planning":       "product manager",
  "stakeholder management": "product manager",
  "product strategy":      "product manager",
  "market research":       "product manager",
  "requirement gathering": "product manager",
  "user stories":          "product manager",
  prioritization:          "product manager",
  amplitude:               "product manager",
  mixpanel:                "product manager",
  roadmap:                 "product manager",
  analytics:               "product manager",
  kanban:                  "product manager",
  scrum:                   "product manager",
  agile:                   "product manager",
  notion:                  "product manager",
  linear:                  "product manager",
  trello:                  "product manager",
  jira:                    "product manager",
  okr:                     "product manager",
  pm:                      "product manager",
  product:                 "product manager",

  // ── QA Engineer ───────────────────────────────────────────────────────────
  "qa engineer":           "qa engineer",
  "quality assurance":     "qa engineer",
  "test engineer":         "qa engineer",
  "automation testing":    "qa engineer",
  "manual testing":        "qa engineer",
  "performance testing":   "qa engineer",
  "regression testing":    "qa engineer",
  "integration testing":   "qa engineer",
  "unit testing":          "qa engineer",
  "load testing":          "qa engineer",
  "api testing":           "qa engineer",
  "bug tracking":          "qa engineer",
  "test cases":            "qa engineer",
  playwright:              "qa engineer",
  selenium:                "qa engineer",
  cypress:                 "qa engineer",
  appium:                  "qa engineer",
  testng:                  "qa engineer",
  junit:                   "qa engineer",
  postman:                 "qa engineer",
  swagger:                 "qa engineer",
  testing:                 "qa engineer",
  sdet:                    "qa engineer",
  qa:                      "qa engineer",

  // ── Blockchain Dev ────────────────────────────────────────────────────────
  "blockchain developer":  "blockchain dev",
  "blockchain dev":        "blockchain dev",
  "smart contracts":       "blockchain dev",
  "blockchain architecture": "blockchain dev",
  "web3.js":               "blockchain dev",
  "ethers.js":             "blockchain dev",
  tokenomics:              "blockchain dev",
  blockchain:              "blockchain dev",
  solidity:                "blockchain dev",
  ethereum:                "blockchain dev",
  hardhat:                 "blockchain dev",
  truffle:                 "blockchain dev",
  solana:                  "blockchain dev",
  polygon:                 "blockchain dev",
  avalanche:               "blockchain dev",
  crypto:                  "blockchain dev",
  web3:                    "blockchain dev",
  ipfs:                    "blockchain dev",
  defi:                    "blockchain dev",
  dao:                     "blockchain dev",
  nft:                     "blockchain dev",

  // ── Consultant ────────────────────────────────────────────────────────────
  "management consultant": "consultant",
  "business analyst":      "consultant",
  "business analysis":     "consultant",
  "stakeholder":           "consultant",
  "client management":     "consultant",
  "project management":    "consultant",
  "financial modeling":    "consultant",
  "business strategy":     "consultant",
  "market research":       "consultant",
  "problem solving":       "consultant",
  powerpoint:              "consultant",
  consulting:              "consultant",
  strategy:                "consultant",
  advisory:                "consultant",
  consultant:              "consultant",
};

// ── 3. Special intent keywords (not role-mapped) ──────────────────────────────

const SPECIAL_INTENTS = {
  "hackathon builders": "hackathon",
  "hackathon builder":  "hackathon",
  hackathon:            "hackathon",
  "startup founders":   "startup",
  "startup founder":    "startup",
  startup:              "startup",
};

// ── 4. Query expansion ────────────────────────────────────────────────────────

/**
 * Sorted tokens — longest first so multi-word phrases match before their
 * sub-tokens (e.g. "react native" before "react").
 */
const SORTED_EXPAND_TOKENS = Object.keys(QUERY_EXPAND_MAP).sort(
  (a, b) => b.length - a.length
);

const SORTED_INTENT_TOKENS = Object.keys(SPECIAL_INTENTS).sort(
  (a, b) => b.length - a.length
);

/**
 * expandQuery(rawQuery)
 *
 * Returns { expandedSkills, detectedRoles, isHackathon, isStartup }
 *   detectedRoles — array of matched role strings (supports multi-role queries)
 *   expandedSkills — deduplicated union of all matched roles' skill arrays
 */
const expandQuery = (rawQuery) => {
  const q = rawQuery.toLowerCase().trim();

  // ── Special intents first ─────────────────────────────────────────────────
  for (const token of SORTED_INTENT_TOKENS) {
    if (q.includes(token)) {
      return {
        expandedSkills: [],
        detectedRoles:  [],
        isHackathon:    SPECIAL_INTENTS[token] === "hackathon",
        isStartup:      SPECIAL_INTENTS[token] === "startup",
      };
    }
  }

  // ── Role / skill expansion (collect ALL matches → multi-role support) ─────
  const matchedRoles  = new Set();
  const skillSet      = new Set();
  let   remaining     = q;

  for (const token of SORTED_EXPAND_TOKENS) {
    if (remaining.includes(token)) {
      const role = QUERY_EXPAND_MAP[token];
      if (!matchedRoles.has(role)) {
        matchedRoles.add(role);
        (ROLE_SKILL_MAP[role] || []).forEach((s) => skillSet.add(s));
      }
      // consume the matched token so shorter sub-tokens don't double-fire
      remaining = remaining.replace(token, " ").trim();
    }
  }

  return {
    expandedSkills: Array.from(skillSet),
    detectedRoles:  Array.from(matchedRoles),
    isHackathon:    false,
    isStartup:      false,
  };
};

// ── 5. Role filter value → MongoDB condition ──────────────────────────────────

const ROLE_FILTER_MAP = {
  frontend:      "frontend dev",
  backend:       "backend dev",
  fullstack:     "full stack",
  ml:            "ml engineer",
  ai:            "ai engineer",
  prompt:        "prompt engineer",
  datascientist: "data scientist",
  dataanalyst:   "data analyst",
  devops:        "devops",
  mobile:        "mobile dev",
  designer:      "designer",
  product:       "product manager",
  qa:            "qa engineer",
  blockchain:    "blockchain dev",
  consultant:    "consultant",
};

// ── 6. Availability filter value → MongoDB condition ─────────────────────────

const AVAILABILITY_FILTER_MAP = {
  weekends:  { availability: "weekends" },
  evenings:  { availability: "evenings" },
  fulltime:  { availability: "full-time" },
  flexible:  { availability: "flexible" },
  hackathon: { hackathonInterest: true },
  startup:   { startupInterest: true },
};

// ── 7. Main query builder ─────────────────────────────────────────────────────

/**
 * buildSearchQuery({ q, role, availability, loggedInUserId, excludedIds })
 *
 * Assembles the final MongoDB filter.
 *   q              — free-text search query
 *   role           — ROLE_FILTER_MAP key  (or "all")
 *   availability   — AVAILABILITY_FILTER_MAP key (or "all")
 *   loggedInUserId — ObjectId of the requesting user
 *   excludedIds    — Set of ID strings to always exclude (self + interacted)
 */
const buildSearchQuery = ({
  q,
  role,
  availability,
  loggedInUserId,
  excludedIds,
}) => {
  const andConditions = [];

  // ── Always exclude self + previously interacted users ─────────────────────
  const excluded = excludedIds
    ? Array.from(excludedIds)
    : [loggedInUserId.toString()];

  const base = { _id: { $nin: excluded } };

  // ── A. Free-text search ───────────────────────────────────────────────────
  if (q && q.trim()) {
    const raw = q.trim();

    const {
      expandedSkills,
      detectedRoles,
      isHackathon,
      isStartup,
    } = expandQuery(raw);

    const orClauses = [];

    // Name search
    orClauses.push({ firstName: { $regex: raw, $options: "i" } });
    orClauses.push({ lastName:  { $regex: raw, $options: "i" } });

    // Profile text fields
    orClauses.push({ about:         { $regex: raw, $options: "i" } });
    orClauses.push({ goals:         { $regex: raw, $options: "i" } });
    orClauses.push({ lookingFor:    { $regex: raw, $options: "i" } });
    orClauses.push({ learningGoals: { $regex: raw, $options: "i" } });

    // Direct skill keyword match
    orClauses.push({ skills: { $regex: raw, $options: "i" } });

    // Semantic skill expansion — single $in covers all matched-role skills
    if (expandedSkills.length > 0) {
      orClauses.push({
        skills: { $in: expandedSkills.map((s) => new RegExp(s, "i")) },
      });
    }

    // Detected roles — push one clause per matched role
    for (const detectedRole of detectedRoles) {
      orClauses.push({
        lookingFor: { $regex: detectedRole, $options: "i" },
      });
    }

    // Special intents
    if (isHackathon) orClauses.push({ hackathonInterest: true });
    if (isStartup)   orClauses.push({ startupInterest:   true });

    andConditions.push({ $or: orClauses });
  }

  // ── B. Role filter ─────────────────────────────────────────────────────────
  if (role && role !== "all" && ROLE_FILTER_MAP[role]) {
    const mappedRole  = ROLE_FILTER_MAP[role];
    const roleSkills  = ROLE_SKILL_MAP[mappedRole] || [];

    const roleClauses = [
      { lookingFor: { $regex: mappedRole, $options: "i" } },
    ];

    if (roleSkills.length > 0) {
      roleClauses.push({
        skills: { $in: roleSkills.map((s) => new RegExp(s, "i")) },
      });
    }

    andConditions.push({ $or: roleClauses });
  }

  // ── C. Availability filter ────────────────────────────────────────────────
  if (
    availability &&
    availability !== "all" &&
    AVAILABILITY_FILTER_MAP[availability]
  ) {
    andConditions.push(AVAILABILITY_FILTER_MAP[availability]);
  }

  // ── Final query ───────────────────────────────────────────────────────────
  if (andConditions.length === 0) return base;

  return { ...base, $and: andConditions };
};

module.exports = {
  buildSearchQuery,
  expandQuery,
  ROLE_SKILL_MAP,
  ROLE_FILTER_MAP,
  AVAILABILITY_FILTER_MAP,
};