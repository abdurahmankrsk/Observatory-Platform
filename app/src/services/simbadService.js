/**
 * SIMBAD Astronomical Database service — searches for named objects via TAP.
 * Covers stars, nebulae, galaxies, and other deep-sky objects.
 *
 * Port of backend/services/simbad_service.py
 */

import { getCache, setCache } from './cache.js'

const CACHE_TTL = 3600 // 1 hour
const SIMBAD_TAP = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync'

// ── Curated catalog objects ──────────────────────────────────────────────────

/** @type {Record<string, import('../types/astronomy.js').CelestialObject>} */
export const KNOWN_OBJECTS = {
  andromeda: {
    id: 'andromeda', name: 'Andromeda Galaxy (M31)', type: 'galaxy',
    ra: 10.6847929, dec: 41.269065, distance_ly: 2537000,
    description: 'The nearest large spiral galaxy to the Milky Way, on a collision course with us in ~4.5 billion years.',
    fun_fact: 'Andromeda contains roughly one trillion stars — more than double the Milky Way.',
  },
  m31: {
    id: 'andromeda', name: 'Andromeda Galaxy (M31)', type: 'galaxy',
    ra: 10.6847929, dec: 41.269065, distance_ly: 2537000,
    description: 'The nearest large spiral galaxy to the Milky Way, on a collision course with us in ~4.5 billion years.',
    fun_fact: 'Andromeda contains roughly one trillion stars — more than double the Milky Way.',
  },
  'orion nebula': {
    id: 'orion_nebula', name: 'Orion Nebula (M42)', type: 'nebula',
    ra: 83.8221, dec: -5.3911, distance_ly: 1344,
    description: 'A stellar nursery in the constellation Orion, one of the most studied objects in the night sky.',
    fun_fact: 'The Orion Nebula is 24 light-years across and contains over 700 stars in various stages of formation.',
  },
  m42: {
    id: 'orion_nebula', name: 'Orion Nebula (M42)', type: 'nebula',
    ra: 83.8221, dec: -5.3911, distance_ly: 1344,
    description: 'A stellar nursery in the constellation Orion, one of the most studied objects in the night sky.',
    fun_fact: 'The Orion Nebula is 24 light-years across and contains over 700 stars in various stages of formation.',
  },
  vega: {
    id: 'vega', name: 'Vega', type: 'star',
    ra: 279.23473, dec: 38.78369, distance_ly: 25.04,
    description: 'The brightest star in the constellation Lyra, and the second-brightest star in the northern sky.',
    fun_fact: 'Vega rotates so fast it\'s noticeably flattened at the poles — its equatorial radius is 19% larger than its polar radius.',
    star: { temperature_k: 9602, radius_solar: 2.362, spectral_type: 'A0Va' },
  },
  sirius: {
    id: 'sirius', name: 'Sirius', type: 'star',
    ra: 101.28715, dec: -16.71611, distance_ly: 8.6,
    description: 'The brightest star in Earth\'s night sky, in the constellation Canis Major.',
    fun_fact: 'Sirius is actually a binary system — Sirius A orbited by the white dwarf Sirius B.',
    star: { temperature_k: 9940, radius_solar: 1.711, spectral_type: 'A1V' },
  },
  'betelgeuse': {
    id: 'betelgeuse', name: 'Betelgeuse (α Orionis)', type: 'star',
    ra: 88.7929, dec: 7.4070, distance_ly: 642.5,
    description: 'A red supergiant star of spectral type M1-2 and one of the largest stars visible to the naked eye.',
    fun_fact: 'If Betelgeuse were at the center of the Solar System, its surface would extend past the asteroid belt, engulfing Mercury, Venus, Earth, and Mars.',
    star: { spectral_type: 'M1-2', temperature_k: 3500 },
  },
  'polaris': {
    id: 'polaris', name: 'Polaris (North Star)', type: 'star',
    ra: 37.9545, dec: 89.2641, distance_ly: 433,
    description: 'The North Star, a yellow supergiant that closely aligns with Earth\'s axis of rotation in the northern sky.',
    fun_fact: 'Polaris is actually a triple star system, consisting of the main yellow supergiant and two smaller companions.',
    star: { spectral_type: 'F7Ib', temperature_k: 6000 },
  },
  sun: {
    id: 'sun', name: 'Sun', type: 'star', distance_au: 1.0,
    description: 'Our home star — a G-type main-sequence (G2V) yellow dwarf that holds 99.8% of the Solar System\'s mass and drives almost all of Earth\'s weather and life.',
    fun_fact: 'The Sun is so large that about 1.3 million Earths could fit inside it, yet it is only an average-sized star.',
    star: { temperature_k: 5778, radius_solar: 1.0, luminosity_solar: 1.0, spectral_type: 'G2V' },
  },
  sol: {
    id: 'sun', name: 'Sun', type: 'star', distance_au: 1.0,
    description: 'Our home star — a G-type main-sequence (G2V) yellow dwarf that holds 99.8% of the Solar System\'s mass and drives almost all of Earth\'s weather and life.',
    fun_fact: 'The Sun is so large that about 1.3 million Earths could fit inside it, yet it is only an average-sized star.',
    star: { temperature_k: 5778, radius_solar: 1.0, luminosity_solar: 1.0, spectral_type: 'G2V' },
  },
  'sagittarius a*': {
    id: 'sagittarius_a_star', name: 'Sagittarius A*', type: 'blackhole', otype: 'BH',
    ra: 266.41683, dec: -29.00781, distance_ly: 26673,
    description: 'The supermassive black hole at the centre of the Milky Way, about 4 million times the mass of the Sun.',
    fun_fact: 'In 2022 the Event Horizon Telescope released the first direct image of Sagittarius A*\'s glowing accretion ring.',
  },
  'sgr a*': {
    id: 'sagittarius_a_star', name: 'Sagittarius A*', type: 'blackhole', otype: 'BH',
    ra: 266.41683, dec: -29.00781, distance_ly: 26673,
    description: 'The supermassive black hole at the centre of the Milky Way, about 4 million times the mass of the Sun.',
    fun_fact: 'In 2022 the Event Horizon Telescope released the first direct image of Sagittarius A*\'s glowing accretion ring.',
  },
  'horsehead nebula': {
    id: 'horsehead_nebula', name: 'Horsehead Nebula (Barnard 33)', type: 'nebula', otype: 'DNe',
    ra: 85.2458, dec: -2.4583, distance_ly: 1375,
    description: 'A small dark nebula in the constellation Orion. The horse-head feature is dark because it is an opaque dust cloud that lies in front of the bright emission nebula IC 434.',
    fun_fact: 'The heavy concentrations of dust in the Horsehead Nebula region results in alternating sections of nearly complete opacity and transparency.',
  },
  'veil nebula': {
    id: 'veil_nebula', name: 'Veil Nebula (NGC 6960)', type: 'nebula', otype: 'SNR',
    ra: 311.5333, dec: 30.7167, distance_ly: 2400,
    description: 'A cloud of heated and ionized gas and dust in the constellation Cygnus. It constitutes the visible portions of the Cygnus Loop, a massive supernova remnant.',
    fun_fact: 'The source supernova was a star 20 times more massive than the Sun which exploded between 10,000 and 20,000 years ago.',
  },
  'crab nebula': {
    id: 'crab_nebula', name: 'Crab Nebula (M1)', type: 'nebula',
    ra: 83.6287, dec: 22.0147, distance_ly: 6523,
    description: 'The remnant of a supernova explosion recorded by Chinese astronomers in 1054 AD.',
    fun_fact: 'At the heart of the Crab Nebula is a pulsar spinning 30 times per second.',
  },
  'milky way': {
    id: 'milky_way', name: 'Milky Way Galaxy', type: 'galaxy',
    ra: 266.4168, dec: -28.9364, distance_ly: 0,
    description: 'Our home galaxy — a barred spiral galaxy containing 100-400 billion stars.',
    fun_fact: 'The Milky Way is approximately 100,000 light-years in diameter and about 1,000 light-years thick.',
  },
  pleiades: {
    id: 'pleiades', name: 'Pleiades (M45)', type: 'nebula',
    ra: 56.75, dec: 24.1167, distance_ly: 444,
    description: 'An open star cluster in Taurus, also known as the Seven Sisters, visible to the naked eye.',
    fun_fact: 'The Pleiades are only about 100 million years old — extremely young by cosmic standards.',
  },
  'sombrero galaxy': {
    id: 'sombrero_galaxy', name: 'Sombrero Galaxy (M104)', type: 'galaxy',
    ra: 189.9976, dec: -11.6231, distance_ly: 29350000,
    description: 'A spiral galaxy in Virgo seen nearly edge-on, with a bright bulge and a dramatic dark dust lane that give it the look of a sombrero hat.',
    fun_fact: 'The Sombrero Galaxy hosts a supermassive black hole of about one billion solar masses at its center — one of the most massive yet measured in a nearby galaxy.',
  },
  'whirlpool galaxy': {
    id: 'whirlpool_galaxy', name: 'Whirlpool Galaxy (M51)', type: 'galaxy',
    ra: 202.4696, dec: 47.1952, distance_ly: 23000000,
    description: 'A grand-design spiral galaxy in Canes Venatici, interacting with its smaller companion galaxy NGC 5195.',
    fun_fact: 'The Whirlpool was the first galaxy recognized to have a spiral structure, sketched by Lord Rosse in 1845.',
  },
  'triangulum galaxy': {
    id: 'triangulum_galaxy', name: 'Triangulum Galaxy (M33)', type: 'galaxy',
    ra: 23.4621, dec: 30.6602, distance_ly: 2730000,
    description: 'The third-largest galaxy in the Local Group, a spiral galaxy in the constellation Triangulum.',
    fun_fact: 'Under very dark skies, the Triangulum Galaxy is one of the most distant objects visible to the naked eye.',
  },
  'pinwheel galaxy': {
    id: 'pinwheel_galaxy', name: 'Pinwheel Galaxy (M101)', type: 'galaxy',
    ra: 210.8025, dec: 54.3491, distance_ly: 20870000,
    description: 'A face-on spiral galaxy in Ursa Major, notable for its prominent and well-defined spiral arms.',
    fun_fact: 'The Pinwheel Galaxy is nearly twice the diameter of the Milky Way, spanning about 170,000 light-years.',
  },
  '3c 273': {
    id: '3c_273', name: '3C 273', type: 'galaxy', otype: 'QSO',
    ra: 187.2779, dec: 2.0524, distance_ly: 2400000000,
    description: 'The first quasar ever identified and the brightest quasar in the sky — the luminous core of an active galaxy 2.4 billion light-years away.',
    fun_fact: '3C 273 is so luminous it outshines its entire host galaxy by a factor of 100. It was the first object identified as a quasar, in 1963.',
  },
  '3c273': {
    id: '3c_273', name: '3C 273', type: 'galaxy', otype: 'QSO',
    ra: 187.2779, dec: 2.0524, distance_ly: 2400000000,
    description: 'The first quasar ever identified and the brightest quasar in the sky — the luminous core of an active galaxy 2.4 billion light-years away.',
    fun_fact: '3C 273 is so luminous it outshines its entire host galaxy by a factor of 100. It was the first object identified as a quasar, in 1963.',
  },
  'crab pulsar': {
    id: 'crab_pulsar', name: 'Crab Pulsar (PSR B0531+21)', type: 'star', otype: 'Psr',
    ra: 83.6328, dec: 22.0145, distance_ly: 6523,
    description: 'The neutron star at the heart of the Crab Nebula, born in the supernova of 1054 AD and spinning 30 times per second.',
    fun_fact: 'The Crab Pulsar beams radiation so precisely that it was initially mistaken for an alien signal — it was nicknamed "LGM-1" (Little Green Men).',
    star: { spectral_type: 'Psr', temperature_k: 1600000 },
  },
  'psr b0531+21': {
    id: 'crab_pulsar', name: 'Crab Pulsar (PSR B0531+21)', type: 'star', otype: 'Psr',
    ra: 83.6328, dec: 22.0145, distance_ly: 6523,
    description: 'The neutron star at the heart of the Crab Nebula, born in the supernova of 1054 AD and spinning 30 times per second.',
    fun_fact: 'The Crab Pulsar beams radiation so precisely that it was initially mistaken for an alien signal — it was nicknamed "LGM-1" (Little Green Men).',
    star: { spectral_type: 'Psr', temperature_k: 1600000 },
  },
}

/** @type {Record<string, import('../types/astronomy.js').CelestialObject>} */
export const SOLAR_SYSTEM = {
  mercury: { id: 'mercury', name: 'Mercury', type: 'planet', distance_au: 0.387, description: 'The smallest planet and closest to the Sun — a cratered, airless rocky world.', fun_fact: 'Mercury has almost no atmosphere, so its surface swings from 430°C in daylight to -180°C at night.' },
  venus: { id: 'venus', name: 'Venus', type: 'planet', distance_au: 0.723, description: 'A rocky world shrouded in thick sulfuric-acid clouds — the hottest planet in the solar system.', fun_fact: 'Venus\'s runaway greenhouse atmosphere keeps its surface at about 465°C, hot enough to melt lead.' },
  earth: { id: 'earth', name: 'Earth', type: 'planet', distance_au: 1.0, description: 'Our home — an ocean world with continents, water clouds and the only known life in the universe.', fun_fact: 'Earth is the only planet not named after a Greek or Roman deity.' },
  mars: { id: 'mars', name: 'Mars', type: 'planet', distance_au: 1.524, description: 'The Red Planet, a cold desert world, home to Olympus Mons — the largest volcano in the solar system.', fun_fact: 'A day on Mars (a sol) is 24 hours and 37 minutes — almost the same as Earth.' },
  jupiter: { id: 'jupiter', name: 'Jupiter', type: 'planet', distance_au: 5.203, description: 'The largest planet in our solar system, a banded gas giant with the famous Great Red Spot.', fun_fact: 'Jupiter\'s Great Red Spot is a storm that has been raging for at least 350 years.' },
  saturn: { id: 'saturn', name: 'Saturn', type: 'planet', distance_au: 9.537, description: 'The ringed jewel of our solar system, a gas giant with spectacular icy rings.', fun_fact: 'Saturn\'s rings are mostly made of ice particles — some as small as grains of sand, others as large as mountains.' },
  uranus: { id: 'uranus', name: 'Uranus', type: 'planet', distance_au: 19.19, description: 'A pale cyan ice giant tipped on its side, with faint rings and a methane-rich atmosphere.', fun_fact: 'Uranus rotates almost on its side, so each pole gets about 42 years of continuous sunlight then 42 years of darkness.' },
  neptune: { id: 'neptune', name: 'Neptune', type: 'planet', distance_au: 30.07, description: 'The farthest planet from the Sun, a deep-blue ice giant with the strongest winds in the solar system.', fun_fact: 'Winds on Neptune can reach 2,100 km/h — faster than the speed of sound on Earth.' },
  pluto: { id: 'pluto', name: 'Pluto', type: 'planet', distance_au: 39.48, description: 'A dwarf planet in the Kuiper Belt — an icy, rocky world with a nitrogen-ice heart.', fun_fact: 'Pluto is smaller than Earth\'s Moon, and one Pluto year lasts 248 Earth years.' },
  ceres: { id: 'ceres', name: 'Ceres', type: 'planet', distance_au: 2.77, description: 'The largest object in the asteroid belt and the closest dwarf planet — a rocky, icy world.', fun_fact: 'Ceres may hold more fresh water than all of Earth\'s rivers and lakes, locked away as ice.' },
  eris: { id: 'eris', name: 'Eris', type: 'planet', distance_au: 67.8, description: 'A distant, highly reflective icy dwarf planet — its discovery prompted Pluto\'s reclassification.', fun_fact: 'Eris is so far away that the Sun appears as just a very bright star from its frozen surface.' },
}

/** @type {Record<string, import('../types/astronomy.js').CelestialObject>} */
export const MOONS = {
  moon: { id: 'moon', name: 'Moon', type: 'moon', distance_au: 0.00257, description: 'Earth\'s only natural satellite — a grey, heavily cratered rocky world with no atmosphere.', fun_fact: 'The Moon is slowly drifting away from Earth at about 3.8 cm per year.' },
  luna: { id: 'moon', name: 'Moon', type: 'moon', distance_au: 0.00257, description: 'Earth\'s only natural satellite — a grey, heavily cratered rocky world with no atmosphere.', fun_fact: 'The Moon is slowly drifting away from Earth at about 3.8 cm per year.' },
  phobos: { id: 'phobos', name: 'Phobos', type: 'moon', distance_au: 1.524, description: 'The larger, inner moon of Mars — a small, dark, heavily cratered potato-shaped rock.', fun_fact: 'Phobos orbits Mars so fast it rises in the west and sets in the east twice a day.' },
  deimos: { id: 'deimos', name: 'Deimos', type: 'moon', distance_au: 1.524, description: 'The smaller, outer moon of Mars — a tiny, dark, smooth-looking cratered rock.', fun_fact: 'Deimos is so small that from its surface you could throw a rock fast enough to escape into space.' },
  io: { id: 'io', name: 'Io', type: 'moon', distance_au: 5.203, description: 'Jupiter\'s innermost Galilean moon — the most volcanically active world in the solar system, painted in sulfur yellows and molten reds.', fun_fact: 'Io has over 400 active volcanoes, some flinging plumes 500 km above its surface.' },
  europa: { id: 'europa', name: 'Europa', type: 'moon', distance_au: 5.203, description: 'A smooth icy moon of Jupiter, its cracked white crust hiding a global ocean of liquid water.', fun_fact: 'Europa\'s subsurface ocean may contain twice as much water as all of Earth\'s oceans combined.' },
  ganymede: { id: 'ganymede', name: 'Ganymede', type: 'moon', distance_au: 5.203, description: 'Jupiter\'s largest moon and the biggest in the solar system — a grooved mix of grey rock and dirty ice.', fun_fact: 'Ganymede is larger than the planet Mercury and is the only moon with its own magnetic field.' },
  callisto: { id: 'callisto', name: 'Callisto', type: 'moon', distance_au: 5.203, description: 'Jupiter\'s outermost Galilean moon — a dark, ancient, extremely heavily cratered icy world.', fun_fact: 'Callisto\'s surface is the most heavily cratered of any object in the solar system.' },
  titan: { id: 'titan', name: 'Titan', type: 'moon', distance_au: 9.537, description: 'Saturn\'s largest moon — wrapped in a thick orange nitrogen haze, with lakes of liquid methane.', fun_fact: 'Titan is the only moon with a dense atmosphere and the only other place with stable surface liquid.' },
  enceladus: { id: 'enceladus', name: 'Enceladus', type: 'moon', distance_au: 9.537, description: 'A tiny, brilliantly white icy moon of Saturn that erupts geysers of water from its south pole.', fun_fact: 'Enceladus reflects almost 100% of the sunlight that hits it, making it one of the brightest worlds in the solar system.' },
  triton: { id: 'triton', name: 'Triton', type: 'moon', distance_au: 30.07, description: 'Neptune\'s largest moon — a pinkish, icy world with nitrogen geysers, orbiting backwards.', fun_fact: 'Triton orbits Neptune the \'wrong\' way, suggesting it was a Kuiper Belt object captured by Neptune\'s gravity.' },
}

/** @type {Record<string, import('../types/astronomy.js').AsteroidResponse>} */
export const ASTEROIDS = {
  bennu: {
    id: 'bennu', name: '101955 Bennu', type: 'asteroid', distance_au: 1.13,
    description: 'A small, dark, carbon-rich near-Earth asteroid visited by NASA\'s OSIRIS-REx mission.',
    fun_fact: 'OSIRIS-REx grabbed a sample of Bennu in 2020 and returned it to Earth in 2023.',
    asteroid: { diameter_min_km: 0.48, diameter_max_km: 0.51, is_potentially_hazardous: true, absolute_magnitude: 20.9 },
  },
  vesta: {
    id: 'vesta', name: '4 Vesta', type: 'asteroid', distance_au: 2.36,
    description: 'One of the largest bodies in the asteroid belt — a bright, rocky, differentiated protoplanet.',
    fun_fact: 'Vesta is the brightest asteroid and is occasionally visible from Earth with the naked eye.',
    asteroid: { diameter_min_km: 525.0, diameter_max_km: 525.0, is_potentially_hazardous: false, absolute_magnitude: 3.2 },
  },
}

// ── SIMBAD object type mappings ──────────────────────────────────────────────

const GALAXY_OTYPES = new Set([
  'G', 'AGN', 'SyG', 'Sy1', 'Sy2', 'rG', 'LIN', 'QSO', 'Bla', 'BLL',
  'GiG', 'GiC', 'GiP', 'BiC', 'ClG', 'GrG', 'CGG', 'PaG', 'IG', 'SCG',
  'EmG', 'SBG', 'H2G', 'LSB', 'bCG', 'GlG', 'Q?', 'AG?',
])

const NEBULA_OTYPES = new Set([
  'ISM', 'Cld', 'GNe', 'BNe', 'DNe', 'RNe', 'MoC', 'HII', 'SNR', 'SR?',
  'PN', 'PN?', 'EmO', 'HH', 'sh', 'cor', 'bub', 'SFR', 'glb', 'CGb',
  'HVC', 'out', 'flt', 'cmb',
  'Cl*', 'GlC', 'OpC', 'As*', 'Cl?', 'St*', 'MGr',
])

/** @type {Record<string, string>} */
const OTYPE_LABELS = {
  'Psr': 'pulsar',
  'N*': 'neutron star', 'NS': 'neutron star',
  'BH': 'black hole', 'bH': 'black hole',
  'SNR': 'supernova remnant', 'SR?': 'supernova remnant',
  'PN': 'planetary nebula', 'PN?': 'planetary nebula',
  'GNe': 'emission nebula', 'BNe': 'emission nebula', 'HII': 'emission nebula', 'EmO': 'emission nebula',
  'RNe': 'reflection nebula',
  'DNe': 'dark nebula', 'MoC': 'dark nebula',
  'GlC': 'globular cluster', 'OpC': 'open cluster', 'Cl*': 'open cluster',
  'QSO': 'quasar', 'AGN': 'active galactic nucleus', 'Bla': 'blazar', 'BLL': 'blazar',
  'WD*': 'white dwarf', 'BD*': 'brown dwarf',
  'Y*O': 'protostar', 'TTau': 'protostar',
  '**': 'binary star',
}

/**
 * Map a SIMBAD object-type code to one of our visual types: star/nebula/galaxy.
 * @param {string} simbadType
 * @returns {string}
 */
function _mapSimbadType(simbadType) {
  if (!simbadType) return 'star'
  const code = simbadType.trim()
  if (GALAXY_OTYPES.has(code)) return 'galaxy'
  if (NEBULA_OTYPES.has(code)) return 'nebula'
  const t = code.toLowerCase()
  if (['galax', 'agn', 'quasar', 'qso'].some((x) => t.includes(x))) return 'galaxy'
  if (['nebula', 'cluster', 'snr', 'ism', 'hii'].some((x) => t.includes(x))) return 'nebula'
  return 'star'
}

/**
 * Build a CelestialObject from SIMBAD data.
 * @param {string} name
 * @param {string} objType
 * @param {number|null} ra
 * @param {number|null} dec
 * @param {number|null} distLy
 * @param {string|null} spType
 * @param {string|null} otype
 * @returns {import('../types/astronomy.js').CelestialObject}
 */
function _buildSimbadResponse(name, objType, ra, dec, distLy, spType, otype) {
  const code = (otype ?? '').trim()
  const label = OTYPE_LABELS[code]

  if (objType === 'star' && spType) {
    const desc = label
      ? `A ${label} (${spType}) catalogued in SIMBAD.`
      : `A ${spType || 'main sequence'} star in the Milky Way.`
    return {
      id: name.toLowerCase().replace(/ /g, '_').replace(/\+/g, 'p'),
      name,
      type: 'star',
      otype: code || null,
      ra,
      dec,
      distance_ly: distLy,
      description: desc,
      star: { spectral_type: spType },
    }
  }

  const described = label || objType
  return {
    id: name.toLowerCase().replace(/ /g, '_').replace(/\+/g, 'p'),
    name,
    type: objType,
    otype: code || null,
    ra,
    dec,
    distance_ly: distLy,
    description: `A ${described} catalogued through deep-sky surveys.`,
  }
}

/**
 * Parse every row of a SIMBAD TAP JSON response into CelestialObjects.
 * @param {Record<string, any>} data
 * @param {string} fallbackName
 * @returns {import('../types/astronomy.js').CelestialObject[]}
 */
function _parseSimbadAllRows(data, fallbackName) {
  const rows = data.data ?? []
  const cols = data.metadata ?? []
  if (!rows.length || !cols.length) return []

  const colNames = cols.map((c) => (c.name ?? '').toLowerCase())
  const colIndex = (col) => {
    const idx = colNames.indexOf(col)
    return idx === -1 ? null : idx
  }

  return rows.map((row) => {
    const get = (col) => {
      const idx = colIndex(col)
      return idx !== null ? row[idx] : null
    }

    let mainId = get('main_id') ?? fallbackName
    mainId = String(mainId).replace(/\s+/g, ' ').trim()
    // Drop SIMBAD's "NAME " common-name marker for display
    if (mainId.toUpperCase().startsWith('NAME ')) mainId = mainId.slice(5)

    const otype = get('otype') ?? 'star'
    const ra = get('ra')
    const dec = get('dec')
    const plx = get('plx_value') // parallax in mas
    const spType = get('sp_type')

    let distLy = null
    if (plx && plx > 0) distLy = (1000.0 / plx) * 3.26156

    const objType = _mapSimbadType(otype)
    return _buildSimbadResponse(mainId, objType, ra, dec, distLy, spType, otype)
  })
}

/**
 * Run an ADQL query against SIMBAD TAP and parse every returned row.
 * @param {string} adqlQuery
 * @param {string} fallbackName
 * @returns {Promise<import('../types/astronomy.js').CelestialObject[]>}
 */
async function _querySimbadMany(adqlQuery, fallbackName) {
  const url = new URL(SIMBAD_TAP)
  url.searchParams.set('REQUEST', 'doQuery')
  url.searchParams.set('LANG', 'ADQL')
  url.searchParams.set('QUERY', adqlQuery)
  url.searchParams.set('FORMAT', 'json')

  try {
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) })
    if (!resp.ok) return []
    const data = await resp.json()
    return _parseSimbadAllRows(data, fallbackName)
  } catch {
    return []
  }
}

/**
 * Run an ADQL query against SIMBAD TAP and parse its first row.
 * @param {string} adqlQuery
 * @param {string} fallbackName
 * @returns {Promise<import('../types/astronomy.js').CelestialObject|null>}
 */
async function _querySimbad(adqlQuery, fallbackName) {
  const rows = await _querySimbadMany(adqlQuery, fallbackName)
  return rows[0] ?? null
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Search SIMBAD database for a named astronomical object.
 * @param {string} query
 * @returns {Promise<import('../types/astronomy.js').CelestialObject|null>}
 */
export async function searchSimbad(query) {
  const queryLower = query.toLowerCase().trim()
  const queryAlt = queryLower.startsWith('the ') ? queryLower.slice(4).trim() : queryLower

  for (const catalog of [KNOWN_OBJECTS, SOLAR_SYSTEM, MOONS, ASTEROIDS]) {
    if (catalog[queryLower]) return catalog[queryLower]
    if (catalog[queryAlt]) return catalog[queryAlt]
  }

  for (const [key, obj] of Object.entries(KNOWN_OBJECTS)) {
    if (key.includes(queryLower) || (key.length >= 4 && queryLower.includes(key))) return obj
  }

  // If the query didn't match any local curated objects, fallback to live SIMBAD
  const cacheKey = `simbad:${queryLower}`
  const cached = getCache(cacheKey, CACHE_TTL)
  if (cached !== null) return cached

  const norm = query.toUpperCase().replace(/\s+/g, ' ').trim().replace(/'/g, "''")

  let result = await _querySimbad(
    `SELECT TOP 1 main_id, otype, ra, dec, plx_value, sp_type, nbref
     FROM basic JOIN ident ON ident.oidref = basic.oid
     WHERE ident.id = '${norm}'`,
    query
  )

  if (!result) {
    result = await _querySimbad(
      `SELECT TOP 1 main_id, otype, ra, dec, plx_value, sp_type, nbref
       FROM basic JOIN ident ON ident.oidref = basic.oid
       WHERE ident.id LIKE '${norm}%'
       ORDER BY nbref DESC`,
      query
    )
  }

  if (result) setCache(cacheKey, result)
  return result
}

/**
 * Search SIMBAD for objects whose identifier matches query, returning up to limit distinct objects.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<import('../types/astronomy.js').CelestialObject[]>}
 */
export async function searchSimbadMany(query, limit = 12) {
  const queryLower = query.toLowerCase().trim()
  const queryAlt = queryLower.startsWith('the ') ? queryLower.slice(4).trim() : queryLower

  /** @type {import('../types/astronomy.js').CelestialObject[]} */
  const results = []
  const seen = new Set()

  const add = (obj) => {
    if (obj && !seen.has(obj.id)) {
      seen.add(obj.id)
      results.push(obj)
    }
  }

  for (const catalog of [KNOWN_OBJECTS, SOLAR_SYSTEM, MOONS, ASTEROIDS]) {
    if (catalog[queryLower]) add(catalog[queryLower])
    else if (catalog[queryAlt]) add(catalog[queryAlt])
  }
  for (const [key, obj] of Object.entries(KNOWN_OBJECTS)) {
    if (key.includes(queryLower) || (key.length >= 4 && queryLower.includes(key))) add(obj)
  }

  // If we found matches in our curated offline catalogs, return them immediately.
  // This avoids 20+ second timeouts when SIMBAD is under heavy load or offline.
  if (results.length > 0) return results

  // If no local matches, fallback to live SIMBAD TAP queries
  const cacheKey = `simbad_many:${queryLower}:${limit}`
  let cached = getCache(cacheKey, CACHE_TTL)

  if (cached === null) {
    const norm = query.toUpperCase().replace(/\s+/g, ' ').trim().replace(/'/g, "''")

    const exact = await _querySimbadMany(
      `SELECT TOP 1 main_id, otype, ra, dec, plx_value, sp_type, nbref
       FROM basic JOIN ident ON ident.oidref = basic.oid
       WHERE ident.id = '${norm}'`,
      query
    )

    const prefix = await _querySimbadMany(
      `SELECT TOP ${limit * 4} main_id, otype, ra, dec, plx_value, sp_type, nbref
       FROM basic JOIN ident ON ident.oidref = basic.oid
       WHERE ident.id LIKE '${norm}%'
       ORDER BY nbref DESC`,
      query
    )

    cached = [...exact, ...prefix]

    if (!cached.length) {
      cached = await _querySimbadMany(
        `SELECT TOP ${limit * 4} main_id, otype, ra, dec, plx_value, sp_type, nbref
         FROM basic JOIN ident ON ident.oidref = basic.oid
         WHERE ident.id LIKE '%${norm}%'
         ORDER BY nbref DESC`,
        query
      )
    }

    setCache(cacheKey, cached)
  }

  for (const obj of cached) add(obj)
  return results.slice(0, limit)
}

/**
 * Identify the most notable catalogued object near the given sky coordinates via a SIMBAD cone search.
 * @param {number} ra
 * @param {number} dec
 * @param {number} radiusDeg
 * @returns {Promise<import('../types/astronomy.js').CelestialObject|null>}
 */
export async function identifyByCoordinates(ra, dec, radiusDeg = 0.1) {
  const cacheKey = `identify:${ra.toFixed(3)}:${dec.toFixed(3)}:${radiusDeg}`
  const cached = getCache(cacheKey, CACHE_TTL)
  if (cached !== null) return cached

  const adqlQuery = `
    SELECT TOP 5
        main_id, otype, ra, dec, plx_value, sp_type, nbref,
        DISTANCE(POINT('ICRS', ra, dec), POINT('ICRS', ${ra}, ${dec})) AS sep
    FROM basic
    WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${ra}, ${dec}, ${radiusDeg})) = 1
      AND ra IS NOT NULL
    ORDER BY nbref DESC, sep ASC
  `

  const result = await _querySimbad(adqlQuery, `Object near ${ra.toFixed(4)}, ${dec.toFixed(4)}`)
  if (result) setCache(cacheKey, result)
  return result
}

/**
 * Return the curated list of popular objects for the observatory panel.
 * @returns {import('../types/astronomy.js').CelestialObject[]}
 */
export function getPopularObjects() {
  // ── Galaxies ──────────────────────────────────────────────────────────────
  const galaxyKeys = ['andromeda', 'whirlpool galaxy', 'sombrero galaxy']
  // ── Quasars / AGN ─────────────────────────────────────────────────────────
  const quasarKeys = ['3c 273']
  // ── Stars (including Sun) ─────────────────────────────────────────────────
  const starKeys = ['sirius', 'vega', 'polaris', 'betelgeuse', 'sagittarius a*']
  const solarStarKeys = ['sun'] // from SOLAR_SYSTEM
  // ── Nebulas + SNR + Clusters ──────────────────────────────────────────────
  const nebulaKeys = ['orion nebula', 'veil nebula', 'horsehead nebula', 'crab nebula', 'pleiades']
  // ── Pulsar ────────────────────────────────────────────────────────────────
  const pulsarKeys = ['crab pulsar']
  // ── Solar system bodies ───────────────────────────────────────────────────
  const solarKeys = ['earth', 'mars', 'jupiter', 'saturn', 'neptune']
  const moonKeys = ['moon', 'europa']
  const asteroidKeys = ['bennu']

  return [
    ...galaxyKeys.filter((k) => KNOWN_OBJECTS[k]).map((k) => KNOWN_OBJECTS[k]),
    ...quasarKeys.filter((k) => KNOWN_OBJECTS[k]).map((k) => KNOWN_OBJECTS[k]),
    ...starKeys.filter((k) => KNOWN_OBJECTS[k]).map((k) => KNOWN_OBJECTS[k]),
    ...solarStarKeys.filter((k) => SOLAR_SYSTEM[k]).map((k) => SOLAR_SYSTEM[k]),
    ...nebulaKeys.filter((k) => KNOWN_OBJECTS[k]).map((k) => KNOWN_OBJECTS[k]),
    ...pulsarKeys.filter((k) => KNOWN_OBJECTS[k]).map((k) => KNOWN_OBJECTS[k]),
    ...solarKeys.filter((k) => SOLAR_SYSTEM[k]).map((k) => SOLAR_SYSTEM[k]),
    ...moonKeys.filter((k) => MOONS[k]).map((k) => MOONS[k]),
    ...asteroidKeys.filter((k) => ASTEROIDS[k]).map((k) => ASTEROIDS[k]),
  ]
}
