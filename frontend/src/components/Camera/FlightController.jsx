/**
 * FlightController — Manages GSAP camera animation during warp flight.
 * Placed inside the SpaceScene Canvas to access useThree.
 */
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import * as THREE from 'three'
import useObservatoryStore from '../../store/observatoryStore'

export default function FlightController() {
  const { camera } = useThree()
  const scene = useObservatoryStore((s) => s.scene)
  const selectedObject = useObservatoryStore((s) => s.selectedObject)
  const arriveAtObject = useObservatoryStore((s) => s.arriveAtObject)

  useEffect(() => {
    if (scene !== 'flying' || !selectedObject) return

    const distanceLY = selectedObject.distance_ly ?? 10
    const duration = Math.min(3 + Math.log10(Math.max(distanceLY, 1)) * 1.5, 8)

    // Reset to start position
    camera.position.set(0, 1, 10)
    camera.lookAt(0, 0, 0)

    const proxy = {
      posZ: 10,
      fov: 60,
    }

    const tl = gsap.timeline({ onComplete: arriveAtObject })

    // Phase 1: FOV stretch (warp feel)
    tl.to(proxy, {
      fov: 90,
      duration: 0.5,
      ease: 'power3.in',
      onUpdate: () => {
        camera.fov = proxy.fov
        camera.updateProjectionMatrix()
      },
    })
    // Phase 2: Rush toward target
    .to(proxy, {
      posZ: -200,
      duration: duration - 1.5,
      ease: 'expo.in',
      onUpdate: () => {
        camera.position.z = proxy.posZ
        camera.lookAt(0, 0, proxy.posZ - 100)
      },
    })
    // Phase 3: Decelerate + zoom out on arrival
    .to(proxy, {
      posZ: 6,
      fov: 60,
      duration: 1.5,
      ease: 'expo.out',
      onUpdate: () => {
        camera.position.set(0, 1, proxy.posZ)
        camera.fov = proxy.fov
        camera.updateProjectionMatrix()
        camera.lookAt(0, 0, 0)
      },
    })

    return () => tl.kill()
  }, [scene, selectedObject])

  return null
}
