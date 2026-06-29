'use client'

/**
 * useCameraFlight — GSAP-driven camera animation hook.
 * Manages all camera transitions:
 *   - Exterior → interior observatory entry (4s)
 *   - Warp speed flight to target (3-8s depending on distance)
 *   - Orbital camera around target object
 */
import { useRef, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import * as THREE from 'three'

export function useCameraFlight() {
  const { camera } = useThree()
  const timelineRef = useRef(null)
  const targetRef = useRef(new THREE.Vector3())

  /**
   * Kill any running animation and start fresh.
   */
  const killTimeline = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.kill()
      timelineRef.current = null
    }
  }, [])

  /**
   * Animate camera to a position while looking at a target.
   */
  const flyTo = useCallback(
    ({ position, lookAt, duration = 2, ease = 'power2.inOut', onComplete }) => {
      killTimeline()

      const tl = gsap.timeline({ onComplete })
      timelineRef.current = tl

      // We animate a proxy object to avoid GSAP fighting with Three.js internals
      const proxy = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        lx: targetRef.current.x,
        ly: targetRef.current.y,
        lz: targetRef.current.z,
      }

      tl.to(proxy, {
        x: position.x,
        y: position.y,
        z: position.z,
        lx: lookAt.x,
        ly: lookAt.y,
        lz: lookAt.z,
        duration,
        ease,
        onUpdate: () => {
          camera.position.set(proxy.x, proxy.y, proxy.z)
          targetRef.current.set(proxy.lx, proxy.ly, proxy.lz)
          camera.lookAt(targetRef.current)
        },
      })

      return tl
    },
    [camera, killTimeline]
  )

  /**
   * Observatory entry animation:
   * Camera starts outside, flies through entrance into interior.
   * Total duration: 4 seconds.
   */
  const flyIntoObservatory = useCallback(
    (onComplete) => {
      killTimeline()

      const tl = gsap.timeline({ onComplete })
      timelineRef.current = tl

      const proxy = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        lx: 0, ly: 2, lz: 0,
      }

      // Phase 1: Approach dome (0-2s)
      tl.to(proxy, {
        x: 0, y: 4, z: 12,
        duration: 1.5,
        ease: 'power2.in',
        onUpdate: () => {
          camera.position.set(proxy.x, proxy.y, proxy.z)
          camera.lookAt(0, 3, 0)
        },
      })
      // Phase 2: Enter through dome (1.5-3s)
      .to(proxy, {
        x: 0, y: 3, z: 4,
        duration: 1.2,
        ease: 'power1.inOut',
        onUpdate: () => {
          camera.position.set(proxy.x, proxy.y, proxy.z)
          camera.lookAt(0, 2, 0)
        },
      })
      // Phase 3: Settle inside (3-4s)
      .to(proxy, {
        x: 0, y: 2.5, z: -1.5,
        duration: 1.0,
        ease: 'power2.out',
        onUpdate: () => {
          camera.position.set(proxy.x, proxy.y, proxy.z)
          camera.lookAt(0, 3, 5)
        },
      })

      return tl
    },
    [camera, killTimeline]
  )

  /**
   * Warp speed flight animation:
   * Exponential acceleration then ease-out approach to target.
   * Duration scales with distance (3-8 seconds).
   *
   * @param {THREE.Vector3} targetPosition - Where to arrive
   * @param {number} distanceLY - Distance in light-years (for duration scaling)
   * @param {function} onComplete
   */
  const warpFlight = useCallback(
    (targetPosition, distanceLY = 10, onComplete, arrivalDistance = 6) => {
      killTimeline()

      // Duration: 3s for <1 ly, up to 8s for >1000 ly
      const duration = Math.min(3 + Math.log10(Math.max(distanceLY, 1)) * 1.5, 8)

      const tl = gsap.timeline({ onComplete })
      timelineRef.current = tl

      // Fly straight in along the +Z axis toward the object (rendered at the
      // origin): start far back on that axis and approach to the framing
      // distance, with x and y locked to the target's. No lateral or vertical
      // drift — a single straight rush forward, so the warp streaks stay
      // parallel and the camera never swings up or back.
      const target = targetPosition.clone()
      const runway = 60 + Math.min(Math.max(distanceLY, 0), 200)
      const startZ = target.z + arrivalDistance + runway
      const endZ = target.z + arrivalDistance

      camera.position.set(target.x, target.y, startZ)
      camera.lookAt(target)

      const proxy = { z: startZ, fov: camera.fov }

      // Warp stretch: widen FOV during warp for the speed feel.
      tl.to(proxy, {
        fov: 90,
        duration: 0.5,
        ease: 'power3.in',
        onUpdate: () => {
          camera.fov = proxy.fov
          camera.updateProjectionMatrix()
        },
      })
      // Main straight transit.
      .to(proxy, {
        z: endZ,
        duration: duration - 1.2,
        ease: 'expo.inOut',
        onUpdate: () => {
          camera.position.set(target.x, target.y, proxy.z)
          camera.lookAt(target)
        },
      })
      // Restore FOV on arrival.
      .to(proxy, {
        fov: 60,
        duration: 0.7,
        ease: 'power2.out',
        onUpdate: () => {
          camera.fov = proxy.fov
          camera.updateProjectionMatrix()
        },
      }, '-=0.4')

      return tl
    },
    [camera, killTimeline]
  )

  /**
   * Telescope targeting animation — smooth pan to new RA/Dec pointing.
   */
  const panToCoordinates = useCallback(
    (ra, dec, onComplete) => {
      killTimeline()

      const tl = gsap.timeline({ onComplete })
      timelineRef.current = tl

      // The telescope points towards raRad
      const raRad = (ra / 360) * Math.PI * 2
      
      // The camera should orbit to stand exactly behind the telescope (180 degrees away)
      const currentAngle = Math.atan2(camera.position.x, camera.position.z)
      const currentRadius = Math.hypot(camera.position.x, camera.position.z)
      
      let diff = (raRad + Math.PI) - currentAngle
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2

      // Compute current look point so we can lerp it smoothly
      const currentLook = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(5).add(camera.position)

      // Target lookAt is aiming directly out the slit (raRad)
      const targetLookX = Math.sin(raRad) * 5
      const targetLookZ = Math.cos(raRad) * 5
      // Map Dec so we look up at the slit, but not down into the floor
      const targetLookY = 2.5 + Math.max(0, Math.sin((dec * Math.PI) / 180)) * 3

      const proxy = { 
        angle: currentAngle,
        radius: currentRadius,
        camY: camera.position.y,
        lx: currentLook.x, 
        ly: currentLook.y, 
        lz: currentLook.z 
      }

      tl.to(proxy, {
        angle: currentAngle + diff,
        radius: 2.5,
        camY: 2.5,
        lx: targetLookX,
        ly: targetLookY,
        lz: targetLookZ,
        duration: 2.0,
        ease: 'power2.inOut',
        onUpdate: () => {
          // Move camera in an orbit
          camera.position.set(Math.sin(proxy.angle) * proxy.radius, proxy.camY, Math.cos(proxy.angle) * proxy.radius)
          // Look out the slit
          camera.lookAt(proxy.lx, proxy.ly, proxy.lz)
        },
      })

      return tl
    },
    [camera, killTimeline]
  )

  return { flyTo, flyIntoObservatory, warpFlight, panToCoordinates, killTimeline }
}
