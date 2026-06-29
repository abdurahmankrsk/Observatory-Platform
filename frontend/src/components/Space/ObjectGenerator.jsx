/**
 * ObjectGenerator — the render router for the procedural system.
 *
 * Given a backend CelestialObject it builds the appearance descriptor (via
 * useProceduralGen → ProceduralAppearanceBuilder) and mounts the matching
 * generator component based on descriptor.generator. This is the single switch
 * the rest of the scene depends on; adding a new object class means adding one
 * generator and one case here.
 *
 * Performance: this component is only mounted by SpaceScene while the user is
 * actually viewing an object (scene === 'viewing'); leaving the object unmounts
 * it, so React-three-fiber disposes the heavy geometries/materials. That gives
 * us lazy generation + teardown for free.
 */
import React from 'react'
import { useProceduralGen } from '../../hooks/useProceduralGen'
import { Generator } from '../../procedural/CelestialType'

import ProceduralPlanet from './ProceduralPlanet'
import ProceduralAsteroid from './ProceduralAsteroid'
import Star from './Star'
import BinaryStarGenerator from './BinaryStarGenerator'
import Nebula from './Nebula'
import OrbitalPath from './OrbitalPath'
import GalaxyGenerator from './GalaxyGenerator'
import BlackHoleGenerator from './BlackHoleGenerator'
import NeutronStarGenerator from './NeutronStarGenerator'
import QuasarGenerator from './QuasarGenerator'
import SupernovaRemnantGenerator from './SupernovaRemnantGenerator'
import StarClusterGenerator from './StarClusterGenerator'
import UnknownObject from './UnknownObject'

export default function ObjectGenerator({ object, position = [0, 0, 0] }) {
  const params = useProceduralGen(object)
  if (!object || !params) return null

  switch (params.generator) {
    case Generator.Planet:
      return (
        <group position={position}>
          <ProceduralPlanet params={params} position={[0, 0, 0]} />
          {object.exoplanet?.semi_major_axis_au && (
            <OrbitalPath
              semiMajorAxis={object.exoplanet.semi_major_axis_au}
              eccentricity={0.05}
              scale={1.5}
              color="#4FACFE"
              opacity={0.2}
            />
          )}
        </group>
      )

    case Generator.Star:
      return <Star params={params} position={position} />

    case Generator.BinaryStar:
      return <BinaryStarGenerator params={params} position={position} />

    case Generator.NeutronStar:
      return <NeutronStarGenerator params={params} position={position} />

    case Generator.BlackHole:
      return <BlackHoleGenerator params={params} position={position} />

    case Generator.Quasar:
      return <QuasarGenerator params={params} position={position} />

    case Generator.SupernovaRemnant:
      return <SupernovaRemnantGenerator params={params} position={position} />

    case Generator.Galaxy:
      return <GalaxyGenerator params={params} position={position} />

    case Generator.Nebula:
      return <Nebula params={params} position={position} />

    case Generator.Cluster:
      return <StarClusterGenerator params={params} position={position} />

    case Generator.Asteroid:
    case Generator.Comet:
      return <ProceduralAsteroid params={params} position={position} />

    case Generator.Unknown:
      return <UnknownObject params={params} position={position} />

    default:
      return <UnknownObject params={params} position={position} />
  }
}
