/**
 * Central config for feed scoring.
 * Tweak weights or add new roles here — nowhere else.
 * Weights must always sum to 100.
 */

const WEIGHTS = {
  lookingFor:              20,   // does other's skills match what I want?
  preferredRoles:          15,   // do other's skills match my desired-dev preferences?
  skills:                  10,   // raw skill overlap (Jaccard)
  goals:                   8,   // shared goals
  timezone:                 6,   // my timezone vs other's timezone
  preferredTimezones:       6,   // other's timezone matches my preferred timezones
  experienceLevel:          5,   // my level vs other's level
  preferredExperienceLevel: 5,   // other matches my preferred experience level
  preferredAvailability:    5,   // other's availability matches my preference
  preferredInterests:       15,   // other's interests match what I prefer
  interests:                3,   // both have hackathon/startup interest (my vs other)
  projects:                 2,   // project/learning keyword overlap
};
// 20 + 15 + 18 + 10 + 6 + 6 + 5 + 5 + 5 + 5 + 3 + 2 = 100 ✓

/**
 * Maps each lookingFor role to its canonical skill keywords.
 * Matching is substring-based, so "react" matches "ReactJS", "react native" etc.
 */
const ROLE_SKILL_MAP = {
  "frontend dev": [
    "html","html5","css","css3","scss","sass","less",
    "javascript","typescript","es6","es7","react","reactjs",
    "nextjs","next.js","gatsby","remix","vue","vuejs","nuxtjs",
    "angular","svelte","astro","solidjs","jquery",
    "redux","zustand","mobx","recoil","context api",
    "tailwind","bootstrap","material ui","mui","chakra ui",
    "ant design","shadcn","framer motion","storybook",
    "webpack","vite","parcel","babel",
    "responsive design","web accessibility","seo",
    "pwa","websocket","graphql","rest api","axios",
    "react query","tanstack query","swr",
    "jest","vitest","cypress","playwright",
    "figma","ui","ux","frontend architecture"
  ],

  "backend dev": [
    "node","nodejs","express","nestjs","fastify","hapi",
    "python","django","flask","fastapi",
    "java","spring","springboot",
    "c#",".net","dotnet","asp.net",
    "php","laravel","symfony",
    "ruby","rails",
    "go","golang",
    "rust",
    "graphql","rest","rest api","grpc",
    "microservices","event driven architecture",
    "postgresql","mysql","mongodb","redis",
    "sqlite","cassandra","dynamodb",
    "firebase","supabase",
    "prisma","typeorm","sequelize","mongoose",
    "kafka","rabbitmq","sqs",
    "docker","kubernetes",
    "jwt","oauth","authentication","authorization",
    "api design","system design","websocket",
    "serverless","cron jobs","caching"
  ],

  "full stack": [
    "html","css","javascript","typescript",
    "react","reactjs","nextjs","next.js",
    "vue","angular","redux","tailwind",
    "node","nodejs","express","nestjs",
    "django","flask","laravel",
    "mongodb","mongoose",
    "mysql","postgresql","redis",
    "graphql","rest api",
    "firebase","supabase",
    "docker","aws",
    "prisma","sequelize","typeorm",
    "jwt","oauth",
    "system design","api integration",
    "websocket"
  ],

  "ml engineer": [
    "python","tensorflow","pytorch","keras",
    "sklearn","scikit-learn",
    "numpy","pandas",
    "matplotlib","seaborn","plotly",
    "xgboost","lightgbm","catboost",
    "machine learning","deep learning",
    "supervised learning","unsupervised learning",
    "reinforcement learning",
    "feature engineering",
    "model deployment",
    "computer vision","opencv",
    "nlp","transformers","huggingface",
    "spark","hadoop","airflow",
    "mlops","onnx","cuda","jax",
    "rag","vector db",
    "statistics","probability"
  ],

  "ai engineer": [
    "python","sql",
    "machine learning","deep learning",
    "tensorflow","pytorch","keras",
    "scikit-learn","numpy","pandas",
    "llm","gpt","openai","gemini","claude",
    "anthropic","transformers","huggingface",
    "prompt engineering",
    "rag","embeddings",
    "vector db","vector database",
    "pinecone","weaviate","chromadb","faiss","milvus",
    "langchain","langgraph","llamaindex",
    "agents","multi-agent","autogen","crewai",
    "fine tuning","lora","qlora",
    "fastapi","flask",
    "docker","kubernetes",
    "mlflow","weights & biases","wandb",
    "aws","azure","gcp",
    "nlp","computer vision",
    "speech recognition",
    "generative ai","agentic ai"
  ],

  "prompt engineer": [
    "prompt engineering",
    "llm","gpt","claude","openai","anthropic",
    "gemini","transformers",
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
    "prompt testing"
  ],

  "data scientist": [
    "python","r","sql",
    "statistics","probability",
    "hypothesis testing",
    "a/b testing",
    "machine learning",
    "data mining",
    "data analysis",
    "data visualization",
    "predictive modeling",
    "pandas","numpy",
    "matplotlib","seaborn","plotly",
    "tableau","power bi",
    "jupyter","excel",
    "scikit-learn",
    "feature engineering"
  ],

  "data analyst": [
    "sql","excel","google sheets",
    "power bi","tableau",
    "looker","looker studio",
    "data visualization",
    "dashboarding",
    "reporting",
    "business intelligence",
    "statistics",
    "python","pandas",
    "a/b testing",
    "google analytics",
    "data cleaning",
    "data analysis",
    "etl"
  ],

  "designer": [
    "figma","sketch","adobe xd",
    "invision","zeplin",
    "ui","ux",
    "design","prototyping",
    "wireframing",
    "user research",
    "design system",
    "accessibility",
    "motion design",
    "framer",
    "interaction design",
    "usability testing",
    "visual design",
    "information architecture"
  ],

  "product manager": [
    "agile","scrum","kanban",
    "jira","notion","trello","linear",
    "product management",
    "roadmap","okr",
    "analytics",
    "mixpanel","amplitude",
    "a/b testing",
    "user stories",
    "stakeholder management",
    "sprint planning",
    "product strategy",
    "market research",
    "requirement gathering",
    "prioritization"
  ],

  "devops": [
    "docker","kubernetes","k8s",
    "terraform","ansible","pulumi",
    "jenkins","github actions",
    "gitlab ci","circleci",
    "aws","azure","gcp",
    "linux","bash","shell scripting",
    "nginx","apache",
    "helm","argocd",
    "prometheus","grafana",
    "datadog","elk stack",
    "ci/cd","iac",
    "monitoring","logging",
    "cloudformation",
    "ecs","eks"
  ],

  "mobile dev": [
    "react native","flutter",
    "swift","swiftui",
    "kotlin","android",
    "ios","dart",
    "expo","ionic",
    "xamarin",
    "jetpack compose",
    "firebase",
    "realm",
    "mobile ui",
    "mobile architecture",
    "play store deployment",
    "app store deployment"
  ],

  "qa engineer": [
    "selenium","cypress",
    "playwright","appium",
    "jest","vitest",
    "junit","testng",
    "testing",
    "manual testing",
    "automation testing",
    "api testing",
    "postman","swagger",
    "load testing",
    "performance testing",
    "regression testing",
    "integration testing",
    "unit testing",
    "jira",
    "bug tracking",
    "test cases"
  ],

  "blockchain dev": [
    "solidity","ethereum",
    "web3","web3.js","ethers.js",
    "smart contracts",
    "hardhat","truffle",
    "solana","rust",
    "defi","dao",
    "ipfs",
    "polygon",
    "avalanche",
    "nft",
    "tokenomics",
    "blockchain architecture"
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
    "business strategy"
  ],

  "any": [],
};

// Ordered: used for adjacency scoring in experienceLevel
const EXPERIENCE_ORDER = ["beginner", "intermediate", "advanced"];

// Maps preferredInterests values → which user fields they correspond to
const INTEREST_FIELD_MAP = {
  "hackathons":  "hackathonInterest",
  "startups":    "startupInterest",
  "open source": "goals",      // check goals array includes "open source"
  "freelance":   "goals",      // check goals array includes "freelance"
  "learning":    "goals",      // check goals array includes "learn new tech"
  "research":    "goals",      // general learning / projects
};

module.exports = { WEIGHTS, ROLE_SKILL_MAP, EXPERIENCE_ORDER, INTEREST_FIELD_MAP };