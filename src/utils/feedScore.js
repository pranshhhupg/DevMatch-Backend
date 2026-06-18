/**
 * Pure scoring module — no DB calls, no side effects.
 * Each scorer returns { score: 0–100, reason: string | null }
 *
 * Two distinct concepts are scored:
 *   A) "my profile" vs "other's profile"  — skills, experience, timezone, goals, interests
 *   B) "my preferred-dev preferences" vs "other's actual attributes" — preferredRoles,
 *      preferredTimezones, preferredExperienceLevel, preferredAvailability, preferredInterests
 */
const { WEIGHTS, ROLE_SKILL_MAP, EXPERIENCE_ORDER, INTEREST_FIELD_MAP } = require("./feedConstants");

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
 * roleToSkillScore — kept for internal use by scorePreferredRoles complementarity check.
 * Given a list of roles + a candidate's skills → returns 0–100 (continuous).
 */
function roleToSkillScore(roles, candidateSkills) {
  if (!roles.length || !candidateSkills.length) return 0;
  let totalRoleScore = 0;
  let validRoles = 0;
  for (const role of roles) {
    const required = ROLE_SKILL_MAP[role];
    if (!required?.length) continue;
    validRoles++;
    const matched = required.filter((req) =>
      candidateSkills.some((cand) => cand.includes(req) || req.includes(cand))
    );
    totalRoleScore += matched.length >= 3 ? 100 : (matched.length / 3) * 100;
  }
  return validRoles === 0 ? 0 : Math.round(totalRoleScore / validRoles);
}

/**
 * skillMatchScore — used for skill-domain fallback in scorerole.
 *
 * Counts how many of the candidate's skills match the canonical skill list
 * for the requested roles, then maps the count to a fixed tier:
 *
 *   4+ matched skills → 100
 *   3  matched skills →  80
 *   2  matched skills →  60
 *   < 2               →   0
 *
 * Always returns a value ≤ the role-label match ceiling so role label
 * matches are always ranked above pure skill matches.
 */
function skillMatchScore(wantedRoles, candidateSkills) {
  if (!wantedRoles.length || !candidateSkills.length) return 0;

  const normalSkills = candidateSkills.map((s) => s.toLowerCase());

  // Collect all canonical skills for every wanted role (union, deduplicated)
  const canonicalSet = new Set();
  for (const role of wantedRoles) {
    const required = ROLE_SKILL_MAP[role] || [];
    required.forEach((r) => canonicalSet.add(r.toLowerCase()));
  }

  if (!canonicalSet.size) return 0;

  // Count how many candidate skills hit the canonical set (substring match)
  let matchCount = 0;
  for (const canon of canonicalSet) {
    if (normalSkills.some((s) => s.includes(canon) || canon.includes(s))) {
      matchCount++;
    }
  }

  if (matchCount >= 4) return 100;
  if (matchCount === 3) return 80;
  if (matchCount === 2) return 60;
  return 0;
}

// ─── GROUP A: My profile vs other's profile ───────────────────────────────────

/**
 * scorerole — weight 20
 *
 * Tiered match: role first, skill-domain fallback second.
 *
 * STEP 1 — Exact role match (score 100 → 70)
 *   Does other's declared role (role) appear in what I want (preferredRoles)?
 *   This is the primary signal — a "frontend dev" who wants a "backend dev"
 *   should rank actual backend devs highest.
 *
 * STEP 2 — Skill-domain fallback (score 0 → 60)
 *   If neither side declared a matching role (or either side is "any"),
 *   fall back to checking whether other's SKILLS cover the domains I want.
 *   This lets skill-rich profiles still surface even without role labels.
 *
 * Secondary (35% weight): mutual fit — does MY role match what THEY want?
 *   Same tiered logic applied in reverse.
 */
function scorerole(me, other) {
  const myWanted    = normalize(me.preferredRoles    || []);
  const otherRole   = normalize(other.lookingFor     || []);
  const myRole      = normalize(me.lookingFor        || []);
  const theirWanted = normalize(other.preferredRoles || []);
  const otherSkills = normalize(other.skills         || []);
  const mySkills    = normalize(me.skills            || []);

  const noMyPref    = !myWanted.length    || myWanted.every((r)    => r === "any");
  const noTheirPref = !theirWanted.length || theirWanted.every((r) => r === "any");
  const noOtherRole = !otherRole.length   || otherRole.every((r)   => r === "any");
  const noMyRole    = !myRole.length      || myRole.every((r)      => r === "any");

  // ── Primary: what I want vs who other IS ───────────────────────────────────
  let primary = 0;

  if (noMyPref) {
    // I have no preference → neutral, give moderate score
    primary = 55;
  } else {
    // STEP 1: exact role label match
    if (!noOtherRole) {
      const roleMatched = otherRole.some(
        (r) => r !== "any" && myWanted.includes(r)
      );
      if (roleMatched) {
        primary = 100; // perfect role match
      } else {
        // STEP 2: skill-domain fallback — other's skills cover what I want
        primary = skillMatchScore(myWanted, otherSkills);
      }
    } else {
      // Other has no role declared — fall back to skills only
      primary = skillMatchScore(myWanted, otherSkills);
    }
  }

  // ── Secondary: what they want vs who I AM ──────────────────────────────────
  let secondary = 0;

  if (noTheirPref) {
    secondary = 55;
  } else {
    if (!noMyRole) {
      const roleMatched = myRole.some(
        (r) => r !== "any" && theirWanted.includes(r)
      );
      if (roleMatched) {
        secondary = 100;
      } else {
        secondary = skillMatchScore(theirWanted, mySkills);
      }
    } else {
      secondary = skillMatchScore(theirWanted, mySkills);
    }
  }

  const combined = Math.round(0.65 * primary + 0.35 * secondary);

  // Reason reflects whether it was a role match or a skill-based match
  const namedWanted = myWanted.filter((r) => r !== "any");
  let reason = null;
  if (primary === 100 && namedWanted.length)
    reason = `Role match: ${namedWanted.join(", ")}`;
  else if (primary >= 30 && namedWanted.length)
    reason = `Skill match for: ${namedWanted.join(", ")}`;
  else if (combined >= 40)
    reason = "Partial compatibility";

  return { score: combined, reason };
}

/** skills — weight 18 — Jaccard similarity on raw skill sets */
function scoreSkills(me, other) {
  const mySet    = new Set(normalize(me.skills    || []));
  const theirSet = new Set(normalize(other.skills || []));
  const common   = [...mySet].filter((s) => theirSet.has(s));
  const score    = Math.round(jaccard(mySet, theirSet) * 100);
  const reason   =
    common.length > 0
      ? `${common.length} shared skill${common.length > 1 ? "s" : ""}: ${common.slice(0, 3).join(", ")}`
      : null;
  return { score, reason };
}

/** goals — weight 10 — Jaccard on goals arrays */
function scoreGoals(me, other) {
  const mySet    = new Set(normalize(me.goals    || []));
  const theirSet = new Set(normalize(other.goals || []));
  if (!mySet.size && !theirSet.size) return { score: 0, reason: null };
  const common = [...mySet].filter((g) => theirSet.has(g));
  const score  = Math.round(jaccard(mySet, theirSet) * 100);
  const reason = common.length > 0 ? `Shared goal${common.length > 1 ? "s" : ""}: ${common.join(", ")}` : null;
  return { score, reason };
}

/**
 * timezone — weight 6
 * My timezone vs other's actual timezone.
 * Exact → 100, same continent → 50, else → 0
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
 * experienceLevel — weight 5
 * My level vs other's actual level.
 * Same → 100, 1 apart → 50, 2 apart → 0
 */
function scoreExperience(me, other) {
  if (!me.experienceLevel || !other.experienceLevel) return { score: 0, reason: null };
  const myIdx    = EXPERIENCE_ORDER.indexOf(me.experienceLevel);
  const theirIdx = EXPERIENCE_ORDER.indexOf(other.experienceLevel);
  const diff     = Math.abs(myIdx - theirIdx);
  if (diff === 0) return { score: 100, reason: `Same experience level (${me.experienceLevel})` };
  if (diff === 1) return { score: 50,  reason: "Close experience levels" };
  return { score: 0, reason: null };
}

/**
 * interests — weight 3
 * hackathon/startup interests shared by both.
 */
function scoreInterests(me, other) {
  let score  = 0;
  const tags = [];
  if (me.hackathonInterest && other.hackathonInterest) { score += 50; tags.push("hackathons"); }
  if (me.startupInterest   && other.startupInterest)   { score += 50; tags.push("startups");   }
  return { score, reason: tags.length ? `Both into ${tags.join(" & ")}` : null };
}

/**
 * projects — weight 2
 * Tokenises projectIdeas + learningGoals, Jaccard overlap.
 */
function scoreProjects(me, other) {
  const tokenize = (arr = []) =>
    arr.join(" ").toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const mySet    = new Set(tokenize([...(me.projectIdeas    || []), ...(me.learningGoals    || [])]));
  const theirSet = new Set(tokenize([...(other.projectIdeas || []), ...(other.learningGoals || [])]));
  const score    = Math.round(jaccard(mySet, theirSet) * 100);
  return { score, reason: score > 25 ? "Similar project & learning interests" : null };
}

// ─── GROUP B: My desired-dev preferences vs other's actual attributes ─────────

/**
 * scorePreferredRoles — weight 15
 *
 * Complementarity: "Am I a good fit for what the OTHER person needs?"
 *
 * STEP 1 — Role label check: does MY role (role) match what THEY want (preferredRoles)?
 * STEP 2 — Skill fallback:   if no role label match, do MY skills cover what they want?
 *
 * This is the mirror of scorerole — evaluates mutual fit from the other direction.
 */
function scorePreferredRoles(me, other) {
  const myRole     = normalize(me.lookingFor    || []);
  const mySkills   = normalize(me.skills            || []);
  const theirWant  = normalize(other.preferredRoles || []);

  // Other has no preference ("any") → neutral
  if (!theirWant.length || theirWant.every((r) => r === "any")) {
    return { score: 50, reason: null };
  }

  const noMyRole = !myRole.length || myRole.every((r) => r === "any");

  // STEP 1: exact role label match
  if (!noMyRole) {
    const roleMatched = myRole.some(
      (r) => r !== "any" && theirWant.includes(r)
    );
    if (roleMatched) {
      return { score: 100, reason: "Your role matches what they need" };
    }
  }

  // STEP 2: skill-domain fallback — 4 matches→100, 3→80, 2→60, else→0
  const score = skillMatchScore(theirWant, mySkills);
  let reason = null;
  if (score >= 60) reason = "Your skills cover what they need";
  return { score, reason };
}

/**
 * preferredTimezones — weight 6
 * Does other's timezone appear in my list of preferred timezones?
 * Exact match → 100, same continent prefix → 50, no pref set → 50 (neutral).
 */
function scorePreferredTimezones(me, other) {
  const prefs      = me.preferredTimezones || [];
  const otherTz    = other.timezone;
  if (!prefs.length || !otherTz) return { score: 50, reason: null }; // no preference → neutral

  if (prefs.includes(otherTz))
    return { score: 100, reason: `Timezone match (${otherTz})` };

  const continent   = (tz) => tz.split("/")[0];
  const sameContinent = prefs.some((p) => continent(p) === continent(otherTz));
  if (sameContinent) return { score: 50, reason: "Close to your preferred timezone" };

  return { score: 0, reason: null };
}

/**
 * preferredExperienceLevel — weight 5
 * Does other's experienceLevel match my preference?
 * "any" → 80 (neutral bonus), exact → 100, 1 apart → 40, 2 apart → 0.
 */
function scorePreferredExperienceLevel(me, other) {
  const pref     = me.preferredExperienceLevel || "any";
  const theirLvl = other.experienceLevel;

  if (pref === "any" || !theirLvl) return { score: 80, reason: null };
  if (pref === theirLvl)           return { score: 100, reason: `Preferred experience level match (${theirLvl})` };

  const myIdx    = EXPERIENCE_ORDER.indexOf(pref);
  const theirIdx = EXPERIENCE_ORDER.indexOf(theirLvl);
  const diff     = Math.abs(myIdx - theirIdx);
  if (diff === 1) return { score: 40, reason: "Close to your preferred experience level" };
  return { score: 0, reason: null };
}

/**
 * preferredAvailability — weight 5
 * Does other's availability match my preference?
 * "any" / "flexible" → 80, exact → 100, otherwise 0.
 */
function scorePreferredAvailability(me, other) {
  const pref       = me.preferredAvailability || "any";
  const theirAvail = other.availability;

  if (pref === "any" || !theirAvail)    return { score: 80, reason: null };
  if (pref === theirAvail)              return { score: 100, reason: `Availability match (${theirAvail})` };
  if (theirAvail === "flexible")        return { score: 70,  reason: "They have flexible availability" };
  return { score: 0, reason: null };
}

/**
 * preferredInterests — weight 5
 * Does other actually have the interests I want in a collaborator?
 * Each matched interest contributes equally. Partial credit given.
 */
function scorePreferredInterests(me, other) {
  const prefs = normalize(me.preferredInterests || []);
  if (!prefs.length) return { score: 50, reason: null }; // no preference → neutral

  let matched = 0;
  const matchedLabels = [];

  for (const interest of prefs) {
    let hit = false;
    switch (interest) {
      case "hackathons":
        hit = !!other.hackathonInterest;
        break;
      case "startups":
        hit = !!other.startupInterest;
        break;
      case "open source":
        hit = (other.goals || []).map((g) => g.toLowerCase()).includes("open source");
        break;
      case "freelance":
        hit = (other.goals || []).map((g) => g.toLowerCase()).includes("freelance");
        break;
      case "learning":
        hit = (other.goals || []).map((g) => g.toLowerCase()).includes("learn new tech");
        break;
      case "research":
        // treat as true if they have learning goals or project ideas
        hit = !!(other.learningGoals?.length || other.projectIdeas?.length);
        break;
      default:
        break;
    }
    if (hit) { matched++; matchedLabels.push(interest); }
  }

  const score  = Math.round((matched / prefs.length) * 100);
  const reason = matchedLabels.length
    ? `Shared interest${matchedLabels.length > 1 ? "s" : ""}: ${matchedLabels.join(", ")}`
    : null;
  return { score, reason };
}

// ─── Scorer registry ─────────────────────────────────────────────────────────

const SCORERS = [
  // Group A — profile-to-profile
  { key: "lookingFor",        weight: WEIGHTS.lookingFor,        fn: scorerole              },
  { key: "skills",                  weight: WEIGHTS.skills,                  fn: scoreSkills                  },
  { key: "goals",                   weight: WEIGHTS.goals,                   fn: scoreGoals                   },
  { key: "timezone",                weight: WEIGHTS.timezone,                fn: scoreTimezone                },
  { key: "experienceLevel",         weight: WEIGHTS.experienceLevel,         fn: scoreExperience              },
  { key: "interests",               weight: WEIGHTS.interests,               fn: scoreInterests               },
  { key: "projects",                weight: WEIGHTS.projects,                fn: scoreProjects                },
  // Group B — my preferences vs other's actual attributes
  { key: "preferredRoles",          weight: WEIGHTS.preferredRoles,          fn: scorePreferredRoles          },
  { key: "preferredTimezones",      weight: WEIGHTS.preferredTimezones,      fn: scorePreferredTimezones      },
  { key: "preferredExperienceLevel",weight: WEIGHTS.preferredExperienceLevel,fn: scorePreferredExperienceLevel},
  { key: "preferredAvailability",   weight: WEIGHTS.preferredAvailability,   fn: scorePreferredAvailability   },
  { key: "preferredInterests",      weight: WEIGHTS.preferredInterests,      fn: scorePreferredInterests      },
];

/**
 * @param {Object} me    - logged-in user (mongoose doc or plain object)
 * @param {Object} other - candidate user (plain object from .lean())
 * @returns {{ score: number, reasons: string[], breakdown: Object, rawBreakdown: Object }}
 */
function calculateMatchScore(me, other) {
  const breakdown    = {};
  const rawBreakdown = {};
  const reasons      = [];

  for (const { key, weight, fn } of SCORERS) {
    const { score, reason } = fn(me, other);
    rawBreakdown[key] = score;
    breakdown[key]    = Math.round((score / 100) * weight);
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