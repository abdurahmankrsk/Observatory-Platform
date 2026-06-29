'use client'

/**
 * DescriptionParser — extracts a CelestialType (and notable feature flags) from
 * free-text metadata: object name, description, fun-fact and aliases.
 *
 * This is step 3 of the classification priority chain (explicit type → catalog
 * classification → description parsing → name/heuristic fallback). It exists
 * because the richest signal we get from SIMBAD for an exotic object is usually
 * a sentence like "the remnant of a supernova explosion … a pulsar spinning 30
 * times per second" rather than a clean type code.
 *
 * Rules are ordered MOST-SPECIFIC FIRST: "red supergiant" must win over "red
 * giant" which must win over the bare word "star"; "planetary nebula" must win
 * over "nebula"; "supernova remnant" must win over "supernova"/"nebula".
 */
import { CelestialType } from './CelestialType'

const T = CelestialType

// Each rule: [RegExp, CelestialType]. First match wins.
export const KEYWORD_RULES = [
  // — Compact / explosive endpoints (most specific) —
  // Catch both "supernova remnant" and the common reversed phrasing
  // "remnant of a supernova" (as used for the Crab Nebula).
  [/\bsupernova\s+remnant\b|\bsnr\b|\bremnant\b[\s\S]*?\bsupernova\b|\bsupernova\b[\s\S]*?\bremnant\b/, T.SupernovaRemnant],
  [/\bsuper\s*massive\s+black\s+hole\b|\bblack\s+hole\b/, T.BlackHole],
  [/\bmagnetar\b/, T.Magnetar],
  [/\bpulsar\b/, T.Pulsar],
  [/\bneutron\s+star\b/, T.NeutronStar],
  [/\bquasar\b|\bqso\b|\bblazar\b|\bactive\s+galactic\s+nucleus\b|\bagn\b/, T.Quasar],

  // — Nebulae (specific kinds before the generic word) —
  [/\bplanetary\s+nebula\b/, T.PlanetaryNebula],
  [/\bemission\s+nebula\b|\bh\s*ii\s+region\b|\bhii\s+region\b|\bstellar\s+nursery\b|\bstar[-\s]forming\s+region\b/, T.EmissionNebula],
  [/\breflection\s+nebula\b/, T.ReflectionNebula],
  [/\bdark\s+nebula\b|\babsorption\s+nebula\b|\bmolecular\s+cloud\b/, T.DarkNebula],

  // — Clusters —
  [/\bglobular\s+cluster\b/, T.GlobularCluster],
  [/\bopen\s+(?:star\s+)?cluster\b|\bopen\s+cluster\b/, T.OpenCluster],

  // — Galaxy morphologies (before bare "galaxy") —
  [/\bspiral\s+galaxy\b|\bbarred\s+spiral\b|\bgrand[-\s]design\s+spiral\b/, T.SpiralGalaxy],
  [/\belliptical\s+galaxy\b|\blenticular\s+galaxy\b/, T.EllipticalGalaxy],
  [/\birregular\s+galaxy\b|\bdwarf\s+irregular\b/, T.IrregularGalaxy],

  // — Multiplicity describes the whole system, so it beats a component's type
  //   (e.g. "a binary system … white dwarf Sirius B" → BinaryStar, not WhiteDwarf).
  //   Compact/explosive endpoints above still win (an X-ray binary black hole
  //   stays a black hole). —
  [/\btrinary\s+star\b|\btriple\s+star\b|\btriple\s+star\s+system\b|\btrinary\s+system\b/, T.TrinaryStar],
  [/\bbinary\s+star\b|\bdouble\s+star\b|\bbinary\s+system\b|\bspectroscopic\s+binary\b|\beclipsing\s+binary\b|\bmultiple\s+star\s+system\b/, T.BinaryStar],

  // — Stellar life-cycle stages (specific before generic) —
  [/\bred\s+supergiant\b/, T.RedSupergiant],
  [/\bblue\s+supergiant\b|\bblue\s+giant\b/, T.BlueGiant],
  [/\bred\s+giant\b/, T.RedGiant],
  [/\bwhite\s+dwarf\b/, T.WhiteDwarf],
  [/\bbrown\s+dwarf\b|\bsub[-\s]?stellar\b/, T.BrownDwarf],
  [/\bprotostar\b|\byoung\s+stellar\s+object\b|\bt\s+tauri\b/, T.Protostar],

  // — Solar-system / sub-stellar bodies —
  [/\bexoplanet\b|\bextrasolar\s+planet\b/, T.Exoplanet],
  [/\bcomet\b/, T.Comet],
  [/\basteroid\b|\bminor\s+planet\b|\bnear[-\s]earth\s+object\b/, T.Asteroid],
  [/\bmoon\b|\bnatural\s+satellite\b/, T.Moon],

  // — Generic fallbacks (least specific) —
  [/\bsupernova\b/, T.SupernovaRemnant],
  [/\bnebula\b/, T.Nebula],
  [/\bgalaxy\b/, T.Galaxy],
  [/\bplanet\b/, T.Planet],
  [/\bstar\b/, T.Star],
]

/**
 * Normalise free text for keyword matching: lower-case and collapse whitespace.
 */
function normalize(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Parse a single string for the first matching CelestialType.
 * @param {string} text
 * @returns {string|null} a CelestialType value, or null if nothing matched.
 */
export function parseDescription(text) {
  const t = normalize(text)
  if (!t) return null
  for (const [re, type] of KEYWORD_RULES) {
    if (re.test(t)) return type
  }
  return null
}

/**
 * Detect notable physical features mentioned in the text. These augment the
 * appearance descriptor (e.g. an object whose blurb mentions an "accretion disk"
 * or "relativistic jets" should render those even if the base type is generic).
 * @param {string} text
 */
export function parseFeatures(text) {
  const t = normalize(text)
  return {
    accretionDisk: /\baccretion\s+disk\b|\baccreting\b|\baccretion\b/.test(t),
    jets: /\bjet[s]?\b|\brelativistic\s+jet\b|\bbipolar\s+outflow\b|\bpolar\s+jet\b/.test(t),
    binary: /\bbinary\b|\bdouble\s+star\b|\bcompanion\s+star\b/.test(t),
    habitable: /\bhabitable\b|\bliquid\s+water\b|\bearth[-\s]like\b/.test(t),
    rings: /\bring\s+system\b|\bicy\s+rings\b|\brings\b/.test(t),
    variable: /\bvariable\s+star\b|\bpulsating\b/.test(t),
  }
}
