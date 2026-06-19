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
 * skillsMatch — safe skill comparison that prevents short tokens (e.g. "r", "go")
 * from falsely matching unrelated longer strings via substring.
 *
 * Rules (both inputs already lowercased):
 *  1. Exact match → always true.
 *  2. Either token is ≤ 2 chars → only exact match (no substring).
 *  3. Both tokens are ≥ 3 chars → allow substring only when the shorter
 *     token makes up at least 50% of the longer one's length, preventing
 *     "r" hitting "scrum", "jira", "trello", etc.
 */
function skillsMatch(a, b) {
  if (a === b) return true;
  if (a.length <= 2 || b.length <= 2) return false; // short tokens: exact only
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (!longer.includes(shorter)) return false;
  // Require shorter token to be at least 50% the length of the longer one
  // e.g. "react" (5) inside "reactjs" (7): 5/7=71% ✓
  //      "sql" (3) inside "nosql" (5): 3/5=60% ✓
  //      "r" would be caught by the ≤2 guard above already
  return shorter.length / longer.length >= 0.5;
}

/**
 * roleLabelTrusted — guards against mislabeled `lookingFor` values.
 *
 * A user's `lookingFor` is self-reported and can be filled in incorrectly
 * (e.g. someone writes the role they WANT to find instead of the role they
 * actually ARE). To prevent a mislabeled profile from scoring a perfect
 * role match, we only trust a label if the candidate's own skills show at
 * least minimal overlap with that role's canonical skill set.
 */
function roleLabelTrusted(label, candidateSkills) {
  const required = ROLE_SKILL_MAP[label];
  if (!required?.length) return true; // no skill list to check against (e.g. unmapped role) — trust it
  const matched = required.filter((req) =>
    candidateSkills.some((cand) => skillsMatch(cand, req))
  );
  return matched.length >= 2; // require at least 2 matching skills to confirm the label
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
      candidateSkills.some((cand) => skillsMatch(cand, req))
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

  // Count how many canonical skills the candidate's skill set covers (safe word match)
  let matchCount = 0;
  for (const canon of canonicalSet) {
    if (normalSkills.some((s) => skillsMatch(s, canon))) {
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
 * "Role Fit" — evaluates how well both sides' desires are satisfied.
 *
 * PRIMARY (my desire → other's role):
 *   - If my desired role matches other's declared role → 100%
 *   - If no role match, fall back to other's skill count against my desired role:
 *       4+ skills → 100,  3 → 80,  2 → 60,  0–1 → 0
 *
 * SECONDARY (their desire → my role):
 *   Same logic in reverse.
 *
 * COMBINED Role Fit score:
 *   - Both desires satisfied (primary=100 AND secondary=100) → 100
 *   - Only MY desire satisfied (primary=100, secondary<100)  →  80
 *   - Only THEIR desire satisfied (secondary=100, primary<100) → 60
 *   - Neither fully satisfied → weighted blend (65% primary, 35% secondary)
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
    primary = 55; // no preference → neutral
  } else if (!noOtherRole) {
    // Check if other's declared role matches what I want
    const matchedRole = otherRole.find(
      (r) => r !== "any" && myWanted.includes(r)
    );
    if (matchedRole && roleLabelTrusted(matchedRole, otherSkills)) {
      primary = 100; // desired role matches → 100%
    } else {
      // Role doesn't match → fall back to skill-count tiers
      primary = skillMatchScore(myWanted, otherSkills);
    }
  } else {
    // Other has no role declared → skill-count fallback only
    primary = skillMatchScore(myWanted, otherSkills);
  }

  // ── Secondary: what they want vs who I AM ──────────────────────────────────
  let secondary = 0;

  if (noTheirPref) {
    secondary = 55; // no preference → neutral
  } else if (!noMyRole) {
    const matchedRole = myRole.find(
      (r) => r !== "any" && theirWanted.includes(r)
    );
    if (matchedRole && roleLabelTrusted(matchedRole, mySkills)) {
      secondary = 100;
    } else {
      secondary = skillMatchScore(theirWanted, mySkills);
    }
  } else {
    secondary = skillMatchScore(theirWanted, mySkills);
  }

  // ── Role Fit combination rules ──────────────────────────────────────────────
  // Both desires fully satisfied → 100
  // Only my desire satisfied     →  80
  // Only their desire satisfied  →  60
  // Neither fully satisfied      → weighted blend
  let combined;
  if (primary === 100 && secondary === 100) {
    combined = 100;
  } else if (primary === 100 && secondary < 100) {
    combined = 80;
  } else if (secondary === 100 && primary < 100) {
    combined = 60;
  } else {
    combined = Math.round(0.65 * primary + 0.35 * secondary);
  }

  // Reason reflects the match quality
  const namedWanted = myWanted.filter((r) => r !== "any");
  let reason = null;
  if (primary === 100 && secondary === 100 && namedWanted.length)
    reason = `Mutual role match: ${namedWanted.join(", ")}`;
  else if (primary === 100 && namedWanted.length)
    reason = `Role match: ${namedWanted.join(", ")}`;
  else if (secondary === 100)
    reason = "Your role fits what they need";
  else if (primary >= 60 && namedWanted.length)
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
 * "Does the OTHER person satisfy MY preferred role?"
 * Only the current user's (me) preference matters here.
 *
 * STEP 1 — Role label check: does OTHER's declared role match MY preferredRoles?
 *   If yes → 100%
 * STEP 2 — Skill fallback (only when role doesn't match):
 *   4+ matching skills → 100,  3 → 80,  2 → 60,  0–1 → 0
 */
function scorePreferredRoles(me, other) {
  const myWanted    = normalize(me.preferredRoles   || []);
  const otherRole   = normalize(other.lookingFor    || []);
  const otherSkills = normalize(other.skills        || []);

  // I have no preference → neutral
  if (!myWanted.length || myWanted.every((r) => r === "any")) {
    return { score: 50, reason: null };
  }

  const noOtherRole = !otherRole.length || otherRole.every((r) => r === "any");

  // STEP 1: other's declared role matches what I want → 100%
  if (!noOtherRole) {
    const matchedRole = otherRole.find(
      (r) => r !== "any" && myWanted.includes(r)
    );
    if (matchedRole && roleLabelTrusted(matchedRole, otherSkills)) {
      return { score: 100, reason: `Their role matches your preference` };
    }
  }

  // STEP 2: role doesn't match → check other's skills against my wanted roles
  const score = skillMatchScore(myWanted, otherSkills);
  let reason = null;
  if (score === 100) reason = "Their skills strongly match your preference";
  else if (score >= 60) reason = "Their skills partially match your preference";
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