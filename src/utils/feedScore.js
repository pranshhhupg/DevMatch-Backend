/**
 * Pure scoring module — no DB calls, no side effects.
 * Each scorer returns { score: 0–100, reason: string | null }
 */
const { WEIGHTS, ROLE_SKILL_MAP, EXPERIENCE_ORDER } = require("./feedConstants");

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalize(arr = []) {
  return arr.map((s) => String(s).trim().toLowerCase());
}

function jaccard(setA, setB) {
  if (!setA.size && !setB.size) return 0;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Given roles I want + a candidate's skills → returns 0–100
 * Uses substring matching so "angular" matches "angularjs", "angular 17" etc.
 */
function roleToSkillScore(roles, candidateSkills) {

  if (!roles.length || !candidateSkills.length) {
    return 0;
  }

  // =========================================
  // SCORE 1 → General skill overlap
  // =========================================

  const roleWords = new Set(
    roles.map((r) => r.toLowerCase())
  );

  const candidateWords = new Set(
    candidateSkills.map((s) => s.toLowerCase())
  );

  const commonSkills = [...candidateWords].filter(
    (skill) => roleWords.has(skill)
  );

  const score1 = Math.min(
    (commonSkills.length / 3) * 100,
    100
  );

  // =========================================
  // SCORE 2 → Role keyword mapping
  // =========================================

  let totalRoleScore = 0;
  let validRoles = 0;

  for (const role of roles) {

    const requiredSkills = ROLE_SKILL_MAP[role];

    if (!requiredSkills?.length) continue;

    validRoles++;

    const matchedSkills = requiredSkills.filter(
      (requiredSkill) => {

        return candidateSkills.some(
          (candidateSkill) =>

            candidateSkill.includes(requiredSkill) ||
            requiredSkill.includes(candidateSkill)
        );
      }
    );

    const roleScore =
      matchedSkills.length >= 3
        ? 100
        : (matchedSkills.length / 3) * 100;

    totalRoleScore += roleScore;
  }

  const score2 =
    validRoles === 0
      ? 0
      : totalRoleScore / validRoles;

  // =========================================
  // Return BEST possible match
  // =========================================

  return Math.round(
    Math.max(score1, score2)
  );
}

// ─── Factor Scorers ──────────────────────────────────────────────────────────

/**
 * lookingFor — weight 35
 * 65% primary (does OTHER satisfy what I want?)
 * 35% secondary (do I satisfy what OTHER wants?)
 */
function scoreLookingFor(me, other) {
  const myRoles     = normalize(me.lookingFor    || []);
  const theirRoles  = normalize(other.lookingFor || []);
  const mySkills    = normalize(me.skills        || []);
  const theirSkills = normalize(other.skills     || []);

  const primary   = roleToSkillScore(myRoles,   theirSkills);
  const secondary = roleToSkillScore(theirRoles, mySkills);
  const combined  = Math.round(0.65 * primary + 0.35 * secondary);

  const namedRoles = myRoles.filter((r) => r !== "any");
  let reason = null;
  if (combined >= 70)      reason = `Strong match for: ${namedRoles.join(", ") || "your role needs"}`;
  else if (combined >= 40) reason = "Partial role compatibility";

  return { score: combined, reason };
}

/** skills — weight 25 — Jaccard similarity on skill sets */
function scoreSkills(me, other) {
  const mySet    = new Set(normalize(me.skills    || []));
  const theirSet = new Set(normalize(other.skills || []));

  const common = [...mySet].filter((s) => theirSet.has(s));
  const score  = Math.round(jaccard(mySet, theirSet) * 100);

  const reason =
    common.length > 0
      ? `${common.length} shared skill${common.length > 1 ? "s" : ""}: ${common.slice(0, 3).join(", ")}`
      : null;

  return { score, reason };
}

/** goals — weight 15 */
function scoreGoals(me, other) {
  const mySet    = new Set(normalize(me.goals    || []));
  const theirSet = new Set(normalize(other.goals || []));

  if (!mySet.size && !theirSet.size) return { score: 0, reason: null };

  const common = [...mySet].filter((g) => theirSet.has(g));
  const score  = Math.round(jaccard(mySet, theirSet) * 100);
  const reason =
    common.length > 0
      ? `Shared goal${common.length > 1 ? "s" : ""}: ${common.join(", ")}`
      : null;

  return { score, reason };
}

/**
 * timezone — weight 8
 * Exact → 100, same continent prefix → 50, else → 0
 */
function scoreTimezone(me, other) {
  if (!me.timezone || !other.timezone) return { score: 0, reason: null };
  if (me.timezone === other.timezone)
    return { score: 100, reason: `Same timezone (${me.timezone})` };

  const continent = (tz) => tz.split("/")[0];
  if (continent(me.timezone) === continent(other.timezone))
    return { score: 50, reason: "Similar timezone" };

  return { score: 0, reason: null };
}

/**
 * experienceLevel — weight 7
 * Same → 100, 1 level apart → 50, 2 levels → 0
 */
function scoreExperience(me, other) {
  if (!me.experienceLevel || !other.experienceLevel) return { score: 0, reason: null };

  const myIdx    = EXPERIENCE_ORDER.indexOf(me.experienceLevel);
  const theirIdx = EXPERIENCE_ORDER.indexOf(other.experienceLevel);
  const diff     = Math.abs(myIdx - theirIdx);

  if (diff === 0) return { score: 100, reason: `Same experience level (${me.experienceLevel})` };
  if (diff === 1) return { score: 50, reason: "Close experience levels" };
  return { score: 0, reason: null };
}

/**
 * interests — weight 5 combined
 * hackathon match → 50pts, startup match → 50pts
 */
function scoreInterests(me, other) {
  let score    = 0;
  const tags   = [];

  if (me.hackathonInterest && other.hackathonInterest) { score += 50; tags.push("hackathons"); }
  if (me.startupInterest   && other.startupInterest)   { score += 50; tags.push("startups");   }

  return { score, reason: tags.length ? `Both into ${tags.join(" & ")}` : null };
}

/**
 * projects — weight 5
 * Tokenizes projectIdeas + learningGoals into keywords, Jaccard overlap
 */
function scoreProjects(me, other) {
  const tokenize = (arr = []) =>
    arr.join(" ").toLowerCase().split(/\W+/).filter((w) => w.length > 2);

  const mySet    = new Set(tokenize([...(me.projectIdeas    || []), ...(me.learningGoals    || [])]));
  const theirSet = new Set(tokenize([...(other.projectIdeas || []), ...(other.learningGoals || [])]));

  const score  = Math.round(jaccard(mySet, theirSet) * 100);
  const reason = score > 25 ? "Similar project & learning interests" : null;

  return { score, reason };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

const SCORERS = [
  { key: "lookingFor",      weight: WEIGHTS.lookingFor,      fn: scoreLookingFor  },
  { key: "skills",          weight: WEIGHTS.skills,          fn: scoreSkills      },
  { key: "goals",           weight: WEIGHTS.goals,           fn: scoreGoals       },
  { key: "timezone",        weight: WEIGHTS.timezone,        fn: scoreTimezone    },
  { key: "experienceLevel", weight: WEIGHTS.experienceLevel, fn: scoreExperience  },
  { key: "interests",       weight: WEIGHTS.interests,       fn: scoreInterests   },
  { key: "projects",        weight: WEIGHTS.projects,        fn: scoreProjects    },
];

/**
 * @param {Object} me    - logged-in user (mongoose doc or plain object)
 * @param {Object} other - candidate user (plain object from .lean())
 * @returns {{ score: number, reasons: string[], breakdown: Object }}
 */
function calculateMatchScore(me, other) {
  const breakdown = {};
  const rawBreakdown = {};
  const reasons   = [];

  for (const { key, weight, fn } of SCORERS) {
    const { score, reason } = fn(me, other);
    rawBreakdown[key] = score;

    breakdown[key] = Math.round(
      (score / 100) * weight
    );
    if (reason) reasons.push(reason);
  }

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return {
    score: Math.min(total, 100),
    reasons,
    breakdown,
    rawBreakdown,
  };
}

module.exports = { calculateMatchScore };