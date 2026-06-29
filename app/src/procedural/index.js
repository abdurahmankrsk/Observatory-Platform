'use client'

/**
 * Procedural celestial-object generation system — public surface.
 *
 * Pipeline: classify(object) → buildAppearance(object) → a generator component
 * (routed by descriptor.generator) renders the object procedurally. Nothing here
 * fetches imagery; every object is synthesised from its scientific metadata.
 */
export { CelestialType, PlanetClass, Generator, generatorForType, humanLabel } from './CelestialType'
export { classify, parseSpectralType, classifyStar, classifyPlanetClass } from './CelestialClassifier'
export { parseDescription, parseFeatures, KEYWORD_RULES } from './DescriptionParser'
export { buildAppearance, default as appearanceOf } from './ProceduralAppearanceBuilder'
export { SIMPLEX_3D, SURFACE_VARYINGS, SURFACE_VERTEX } from './ShaderLibrary'
