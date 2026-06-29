'use client'

/**
 * useProceduralGen — memoised entry point to the procedural appearance system.
 *
 * Given a backend CelestialObject, returns the full ProceduralAppearanceDescriptor
 * (classification + every uniform/geometry parameter the matching generator
 * needs). The heavy lifting lives in src/procedural/:
 *   classify() → buildAppearance() → descriptor { generator, ...params }
 *
 * The descriptor is deterministic per object, so the same object always renders
 * identically. Memoised on the object id/type/name so it only rebuilds when the
 * selected object actually changes.
 */
import { useMemo } from 'react'
import { buildAppearance } from '../procedural/ProceduralAppearanceBuilder'

export function useProceduralGen(object) {
  return useMemo(() => buildAppearance(object), [object?.id, object?.type, object?.name])
}

export default useProceduralGen
