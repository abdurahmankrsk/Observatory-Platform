/**
 * Classifier tests — verify the priority pipeline reconstructs precise types from
 * the coarse + textual metadata the backend actually sends (mirrors the real
 * KNOWN_OBJECTS payloads in simbad_service.py).
 */
import { describe, it, expect } from 'vitest'
import { classify, parseSpectralType, classifyPlanetClass } from './CelestialClassifier'
import { CelestialType, PlanetClass } from './CelestialType'
import { buildAppearance } from './ProceduralAppearanceBuilder'
import { parseDescription } from './DescriptionParser'

describe('parseSpectralType', () => {
  it('parses main-sequence dwarfs', () => {
    const a = parseSpectralType('A0Va')
    expect(a.spectralClass).toBe('A')
    expect(a.luminosity).toBe('V')
    expect(a.tempK).toBeGreaterThan(8000)
  })
  it('detects white dwarfs', () => {
    expect(parseSpectralType('DA2').isWhiteDwarf).toBe(true)
  })
  it('detects brown dwarfs (L/T/Y)', () => {
    expect(parseSpectralType('L5').isBrownDwarf).toBe(true)
    expect(parseSpectralType('T6').isBrownDwarf).toBe(true)
  })
  it('parses supergiant luminosity class', () => {
    expect(parseSpectralType('M2 Iab').luminosity).toBe('Iab')
  })
})

describe('classify — stars', () => {
  it('Vega (A0Va) → main sequence', () => {
    const o = { type: 'star', name: 'Vega', star: { spectral_type: 'A0Va', temperature_k: 9602 } }
    expect(classify(o).type).toBe(CelestialType.MainSequenceStar)
  })
  it('Betelgeuse → red supergiant from description', () => {
    const o = {
      type: 'star', name: 'Betelgeuse',
      description: 'A red supergiant in Orion, one of the largest known stars.',
      star: { spectral_type: 'M1-M2', temperature_k: 3500, radius_solar: 887 },
    }
    expect(classify(o).type).toBe(CelestialType.RedSupergiant)
  })
  it('white dwarf via spectral type', () => {
    const o = { type: 'star', name: 'Sirius B', star: { spectral_type: 'DA2' } }
    expect(classify(o).type).toBe(CelestialType.WhiteDwarf)
  })
  it('brown dwarf via spectral type', () => {
    const o = { type: 'star', name: 'Luhman 16', star: { spectral_type: 'L7.5' } }
    expect(classify(o).type).toBe(CelestialType.BrownDwarf)
  })
  it('pulsar in a star-typed payload', () => {
    const o = { type: 'star', name: 'PSR B1919+21', description: 'the first pulsar discovered' }
    expect(classify(o).type).toBe(CelestialType.Pulsar)
  })
  it('stellar-mass black hole in a star-typed payload', () => {
    const o = { type: 'star', name: 'Cygnus X-1', description: 'a stellar-mass black hole in an X-ray binary' }
    expect(classify(o).type).toBe(CelestialType.BlackHole)
  })
})

describe('classify — nebula bucket (SNR / clusters hide here)', () => {
  it('Crab Nebula → supernova remnant', () => {
    const o = {
      type: 'nebula', name: 'Crab Nebula (M1)',
      description: 'The remnant of a supernova explosion recorded in 1054 AD.',
      fun_fact: 'At its heart is a pulsar spinning 30 times per second.',
    }
    expect(classify(o).type).toBe(CelestialType.SupernovaRemnant)
  })
  it('Pleiades → open cluster', () => {
    const o = {
      type: 'nebula', name: 'Pleiades (M45)',
      description: 'An open star cluster in Taurus, also known as the Seven Sisters.',
    }
    expect(classify(o).type).toBe(CelestialType.OpenCluster)
  })
  it('Orion Nebula → emission nebula (stellar nursery)', () => {
    const o = {
      type: 'nebula', name: 'Orion Nebula (M42)',
      description: 'A stellar nursery in the constellation Orion.',
    }
    expect(classify(o).type).toBe(CelestialType.EmissionNebula)
  })
  it('Horsehead → dark nebula', () => {
    const o = { type: 'nebula', name: 'Horsehead', description: 'A dark nebula in Orion shaped like a knight.' }
    expect(classify(o).type).toBe(CelestialType.DarkNebula)
  })
})

describe('classify — galaxies', () => {
  it('Sombrero → spiral galaxy even though it mentions a black hole', () => {
    const o = {
      type: 'galaxy', name: 'Sombrero Galaxy (M104)',
      description: 'A spiral galaxy in Virgo seen nearly edge-on with a dark dust lane.',
      fun_fact: 'It hosts a supermassive black hole of a billion solar masses.',
    }
    expect(classify(o).type).toBe(CelestialType.SpiralGalaxy)
  })
  it('quasar from description', () => {
    const o = { type: 'galaxy', name: '3C 273', description: 'the first quasar ever identified' }
    expect(classify(o).type).toBe(CelestialType.Quasar)
  })
})

describe('classifyPlanetClass — heuristics', () => {
  it('hot → lava world', () => {
    expect(classifyPlanetClass({ exoplanet: { equilibrium_temp_k: 2000, radius_earth: 1.1 } })).toBe(PlanetClass.LavaWorld)
  })
  it('large radius → gas giant', () => {
    expect(classifyPlanetClass({ exoplanet: { radius_earth: 11, equilibrium_temp_k: 900 } })).toBe(PlanetClass.GasGiant)
  })
  it('cold large → ice giant', () => {
    expect(classifyPlanetClass({ exoplanet: { radius_earth: 4, equilibrium_temp_k: 70 } })).toBe(PlanetClass.IceGiant)
  })
  it('cold small → ice world', () => {
    expect(classifyPlanetClass({ exoplanet: { radius_earth: 1, equilibrium_temp_k: 90 } })).toBe(PlanetClass.IceWorld)
  })
})

describe('buildAppearance — routing + descriptor', () => {
  it('routes a black hole to the black-hole generator with a disk', () => {
    const d = buildAppearance({ type: 'star', name: 'Sgr A*', description: 'a supermassive black hole' })
    expect(d.generator).toBe('blackHole')
    expect(d.accretionDisk).toBe(true)
    expect(d.boundingRadius).toBeGreaterThan(0)
  })
  it('routes a pulsar to the neutron-star generator with beams', () => {
    const d = buildAppearance({ type: 'star', name: 'X', description: 'a pulsar' })
    expect(d.generator).toBe('neutronStar')
    expect(d.beams).toBe(true)
    expect(d.pulse).toBe(true)
  })
  it('gives a gas giant banded surface + rings', () => {
    const d = buildAppearance({ type: 'exoplanet', name: 'HD 209458 b', exoplanet: { radius_earth: 15, equilibrium_temp_k: 1400 } })
    expect(d.surfaceStyle).toBe('bands')
    expect(d.hasRings).toBe(true)
  })
  it('every nebula style routes to the nebula generator (not unknown)', () => {
    const cases = [
      ['Orion Nebula', 'a stellar nursery', 'emission'],
      ['NGC 7023', 'a reflection nebula', 'reflection'],
      ['Ring Nebula', 'a planetary nebula in Lyra', 'planetary'],
      ['Horsehead', 'a dark nebula of dust', 'dark'],
    ]
    for (const [name, description, style] of cases) {
      const d = buildAppearance({ type: 'nebula', name, description })
      expect(d.generator).toBe('nebula')
      expect(d.nebulaStyle).toBe(style)
    }
  })
  it('a star cluster routes to the cluster generator', () => {
    const d = buildAppearance({ type: 'nebula', name: 'M13', description: 'a globular cluster' })
    expect(d.generator).toBe('cluster')
  })
  it('falls back to Unknown with an honest message', () => {
    const d = buildAppearance({ name: 'mystery blob' })
    expect(d.generator).toBe('unknown')
    expect(d.message).toMatch(/no accurate visualization/i)
  })
  it('is deterministic for the same object', () => {
    const o = { type: 'star', name: 'Vega', star: { spectral_type: 'A0Va' } }
    expect(buildAppearance(o).seed).toBe(buildAppearance(o).seed)
  })
})

describe('classify — forwarded SIMBAD otype (live objects)', () => {
  it('otype Psr on a star-typed payload → Pulsar', () => {
    expect(classify({ type: 'star', name: 'PSR J', otype: 'Psr' }).type).toBe(CelestialType.Pulsar)
  })
  it('otype N* → NeutronStar', () => {
    expect(classify({ type: 'star', name: 'X', otype: 'N*' }).type).toBe(CelestialType.NeutronStar)
  })
  it('otype QSO → Quasar', () => {
    expect(classify({ type: 'galaxy', name: 'X', otype: 'QSO' }).type).toBe(CelestialType.Quasar)
  })
  it('otype WD* → WhiteDwarf', () => {
    expect(classify({ type: 'star', name: 'X', otype: 'WD*' }).type).toBe(CelestialType.WhiteDwarf)
  })
  it('otype SNR → SupernovaRemnant', () => {
    expect(classify({ type: 'nebula', name: 'X', otype: 'SNR' }).type).toBe(CelestialType.SupernovaRemnant)
  })
})

describe('classify — new coarse types', () => {
  it('coarse blackhole → BlackHole', () => {
    expect(classify({ type: 'blackhole', name: 'Sagittarius A*' }).type).toBe(CelestialType.BlackHole)
  })
  it('coarse moon → Moon', () => {
    expect(classify({ type: 'moon', name: 'Europa', description: 'an icy moon of Jupiter' }).type).toBe(CelestialType.Moon)
  })
})

describe('classifyPlanetClass — description fallback (solar-system bodies)', () => {
  it('"banded gas giant" → GasGiant', () => {
    expect(classifyPlanetClass({ name: 'Jupiter', description: 'a banded gas giant' })).toBe(PlanetClass.GasGiant)
  })
  it('"ice giant" → IceGiant', () => {
    expect(classifyPlanetClass({ name: 'Neptune', description: 'a deep-blue ice giant' })).toBe(PlanetClass.IceGiant)
  })
  it('"Red Planet / desert" → DesertWorld', () => {
    expect(classifyPlanetClass({ name: 'Mars', description: 'The Red Planet, a cold desert world' })).toBe(PlanetClass.DesertWorld)
  })
})

describe('buildAppearance — binary + solar bodies', () => {
  it('Sirius → binary star with two components (white-dwarf companion)', () => {
    const d = buildAppearance({
      type: 'star', name: 'Sirius', star: { spectral_type: 'A1V' },
      description: "The brightest star in Earth's night sky.",
      fun_fact: 'Sirius is actually a binary system — Sirius A orbited by the white dwarf Sirius B.',
    })
    expect(d.celestialType).toBe(CelestialType.BinaryStar)
    expect(d.generator).toBe('binaryStar')
    expect(d.stars.length).toBe(2)
  })
  it('Jupiter → banded gas giant, no rings', () => {
    const d = buildAppearance({ id: 'jupiter', name: 'Jupiter', type: 'planet', description: 'a banded gas giant with the Great Red Spot' })
    expect(d.surfaceStyle).toBe('bands')
    expect(d.hasRings).toBe(false)
  })
  it('Saturn → banded gas giant with prominent rings', () => {
    const d = buildAppearance({ id: 'saturn', name: 'Saturn', type: 'planet', description: 'a gas giant with spectacular icy rings' })
    expect(d.surfaceStyle).toBe('bands')
    expect(d.hasRings).toBe(true)
  })
  it('Europa (moon) routes to the planet generator with its own palette', () => {
    const d = buildAppearance({ id: 'europa', name: 'Europa', type: 'moon', description: 'a smooth icy moon with a cracked crust' })
    expect(d.celestialType).toBe(CelestialType.Moon)
    expect(d.generator).toBe('planet')
    expect(d.radius).toBeLessThan(1) // moons are small
  })
})

describe('parseDescription ordering', () => {
  it('prefers specific phrases over generic ones', () => {
    expect(parseDescription('a red supergiant star')).toBe(CelestialType.RedSupergiant)
    expect(parseDescription('a planetary nebula in Lyra')).toBe(CelestialType.PlanetaryNebula)
    expect(parseDescription('a barred spiral galaxy')).toBe(CelestialType.SpiralGalaxy)
  })
})
