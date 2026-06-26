/**
 * ObservatoryScene — The main Three.js canvas for the observatory interior.
 * Renders when scene is 'observatory', 'targeting', or 'entering'.
 * Camera animates in via GSAP during 'entering' phase.
 */
import React, { useEffect, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import gsap from 'gsap'

import useObservatoryStore from '../../store/observatoryStore'
import Interior from './Interior'

function EntryCamera() {
  const { camera } = useThree()
  const scene = useObservatoryStore((s) => s.scene)
  const arrivedAtObservatory = useObservatoryStore((s) => s.arrivedAtObservatory)

  useEffect(() => {
    if (scene !== 'entering') return

    // Start outside
    camera.position.set(0, 5, 35)
    camera.lookAt(0, 3, 0)

    const proxy = {
      x: 0, y: 5, z: 35,
      lx: 0, ly: 3, lz: 0,
    }

    const tl = gsap.timeline({
      onComplete: () => {
        arrivedAtObservatory()
      },
    })

    // Approach dome exterior
    tl.to(proxy, {
      x: 0, y: 5, z: 18,
      duration: 1.5,
      ease: 'power2.in',
      onUpdate: () => {
        camera.position.set(proxy.x, proxy.y, proxy.z)
        camera.lookAt(proxy.lx, proxy.ly, proxy.lz)
      },
    })
    // Fly through entrance
    .to(proxy, {
      x: 0, y: 3.5, z: 4,
      lx: 0, ly: 2, lz: 0,
      duration: 1.5,
      ease: 'power1.inOut',
      onUpdate: () => {
        camera.position.set(proxy.x, proxy.y, proxy.z)
        camera.lookAt(proxy.lx, proxy.ly, proxy.lz)
      },
    })
    // Settle inside — viewer position
    .to(proxy, {
      x: 0, y: 2.5, z: -1,
      lx: 0, ly: 2.5, lz: 8,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate: () => {
        camera.position.set(proxy.x, proxy.y, proxy.z)
        camera.lookAt(proxy.lx, proxy.ly, proxy.lz)
      },
    })

    return () => tl.kill()
  }, [scene])

  return null
}

export default function ObservatoryScene() {
  return (
    <div className="fixed inset-0">
      <Canvas
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 5, 35], fov: 60, near: 0.01, far: 500 }}
        dpr={Math.min(window.devicePixelRatio, 2)}
        shadows={false}
      >
        <Suspense fallback={null}>
          <Interior />
        </Suspense>

        <EntryCamera />

        <EffectComposer>
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.3}
            luminanceSmoothing={0.9}
            blendFunction={BlendFunction.SCREEN}
          />
          <Noise opacity={0.02} blendFunction={BlendFunction.ADD} />
          <Vignette eskil={false} offset={0.1} darkness={0.6} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
