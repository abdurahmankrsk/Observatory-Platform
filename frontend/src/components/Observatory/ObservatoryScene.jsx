/**
 * ObservatoryScene — The main Three.js canvas for the observatory interior.
 * Renders when scene is 'observatory', 'targeting', or 'entering'.
 * Camera animates in via GSAP during 'entering' phase.
 */
import React, { useEffect, Suspense, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Vector2, Vector3 } from 'three'
import gsap from 'gsap'

import useObservatoryStore from '../../store/observatoryStore'
import Interior from './Interior'

function EntryCamera() {
  const { camera } = useThree()
  const scene = useObservatoryStore((s) => s.scene)
  const telescopeRA = useObservatoryStore((s) => s.telescopeRA)
  const telescopeDec = useObservatoryStore((s) => s.telescopeDec)
  const selectedObject = useObservatoryStore((s) => s.selectedObject)
  const arrivedAtObservatory = useObservatoryStore((s) => s.arrivedAtObservatory)

  const prevScene = useRef(scene)
  const tlRef = useRef(null)
  
  // Track the actual camera lookAt to smoothly interpolate it when the target jumps (e.g., picking first object)
  const currentLookAt = useRef(new Vector3(0, 4.5, 0))
  const currentOrbitAngle = useRef((telescopeRA / 360) * Math.PI * 2)
  const targetRotXInit = -(telescopeDec * Math.PI) / 180 * 0.8
  const currentDecPitch = useRef(targetRotXInit + Math.PI / 4)

  useEffect(() => {
    if (tlRef.current) tlRef.current.kill()

    const targetRotY = (telescopeRA / 360) * Math.PI * 2
    const targetRotX = -(telescopeDec * Math.PI) / 180 * 0.8
    const targetPitch = targetRotX + Math.PI / 4 // The exact physical tilt of the tube
    const targetYaw = targetRotY + Math.PI

    // Helper to calculate exact world coordinates of the camera along the barrel axis
    const getCamLook = (pitch, yaw) => {
      // Forward vector of the telescope
      const fX = Math.sin(pitch) * Math.sin(yaw)
      const fY = Math.cos(pitch)
      const fZ = Math.sin(pitch) * Math.cos(yaw)

      // Right vector (horizontal, perpendicular to Forward)
      // Corrected to actually point Right instead of Left!
      const rX = -Math.cos(yaw)
      const rY = 0
      const rZ = Math.sin(yaw)

      // Eyepiece Position (pivot is at Y=6.25, eyepiece is 6.25 units backward)
      const pivotY = 6.25
      const eX = -6.25 * fX
      const eY = pivotY - 6.25 * fY
      const eZ = -6.25 * fZ

      // Lens Position (6.125 units forward)
      const lX = 6.125 * fX
      const lY = pivotY + 6.125 * fY
      const lZ = 6.125 * fZ

      // Apply a lateral offset to stand to the right of the telescope
      const rightOffset = 2.5

      // Place camera behind the eyepiece and offset to the right
      const cX = eX - 1.5 * fX + rightOffset * rX
      const cY = Math.max(0.5, eY - 1.5 * fY) + rightOffset * rY // Prevent clipping below the floor
      const cZ = eZ - 1.5 * fZ + rightOffset * rZ

      // Point the camera at a distant point along the telescope's axis 
      // so the barrel visually converges on the exact center of the screen.
      // Always look at the distant point along the barrel, even if no object is selected.
      const lookX = lX + 100 * fX
      const lookY = lY + 100 * fY
      const lookZ = lZ + 100 * fZ

      return { cX, cY, cZ, lX: lookX, lY: lookY, lZ: lookZ, fX, fY, fZ }
    }

    const target = getCamLook(targetPitch, targetYaw)

    if (scene === 'entering') {
      currentOrbitAngle.current = targetRotY
      currentDecPitch.current = targetPitch

      // Bias entry x toward the side the observer will settle on,
      // clamped to ±0.5 so the camera stays safely away from the door panels.
      // This ensures the straight-line path to the observer clears the telescope mount.
      const entryX = Math.max(-0.5, Math.min(0.5, target.cX * 0.4))

      camera.position.set(0, 4, 35)
      camera.lookAt(entryX * 0.3, 2.5, 8)

      const proxy = {
        x: 0, y: 4, z: 35,
        lx: entryX * 0.3, ly: 2.5, lz: 8,
      }

      const tl = gsap.timeline({
        onComplete: () => {
          arrivedAtObservatory()
        },
      })
      tlRef.current = tl

      // Phase 1 — approach and pass completely through the door (door opens at 0.5s via Door component)
      // lookAt transitions from the door face to inside the room — camera is NEVER looking backward
      tl.to(proxy, {
        x: entryX, y: 3.2, z: 4,
        lx: 0, ly: 4.5, lz: 0,
        duration: 2.5,
        ease: 'power1.inOut',
        onUpdate: () => {
          camera.position.set(proxy.x, proxy.y, proxy.z)
          camera.lookAt(proxy.lx, proxy.ly, proxy.lz)
          currentLookAt.current.set(proxy.lx, proxy.ly, proxy.lz)
        },
      })
      
      // Phase 2 — steer clear of the telescope mount (radius ~1.9) if the target is behind it
      if (target.cZ < 2.5) {
        const side = target.cX >= 0 ? 1 : -1
        tl.to(proxy, {
          x: side * 4.6, y: 3.6, z: 2.0,
          lx: target.lX * 0.5, ly: (4.5 + target.lY) / 2, lz: target.lZ * 0.5,
          duration: 1.2,
          ease: 'power1.inOut',
          onUpdate: () => {
            camera.position.set(proxy.x, proxy.y, proxy.z)
            camera.lookAt(proxy.lx, proxy.ly, proxy.lz)
            currentLookAt.current.set(proxy.lx, proxy.ly, proxy.lz)
          },
        })
      }

      // Phase 3 — glide directly to the telescope observer position
      // starts already looking at [0, 4.5, 0] (room center), transitions to telescope barrel
      tl.to(proxy, {
        x: target.cX, y: target.cY, z: target.cZ,
        lx: target.lX, ly: target.lY, lz: target.lZ,
        duration: target.cZ < 2.5 ? 1.4 : 2.2,
        ease: target.cZ < 2.5 ? 'power1.out' : 'power1.inOut',
        onUpdate: () => {
          camera.position.set(proxy.x, proxy.y, proxy.z)
          camera.lookAt(proxy.lx, proxy.ly, proxy.lz)
          currentLookAt.current.set(proxy.lx, proxy.ly, proxy.lz)
        },
      })
    } else if (scene === 'observatory' || scene === 'targeting') {
      const cameFromSpace = prevScene.current === 'viewing' || prevScene.current === 'flying'
      const tl = gsap.timeline()
      tlRef.current = tl

      if (cameFromSpace && scene === 'observatory') {
        // Zoom out from the lens
        const lensX = target.lX
        const lensY = target.lY
        const lensZ = target.lZ
        
        const lLookX = lensX + 10 * target.fX
        const lLookY = lensY + 10 * target.fY
        const lLookZ = lensZ + 10 * target.fZ

        camera.position.set(lensX, lensY, lensZ)
        camera.lookAt(lLookX, lLookY, lLookZ)
        
        const proxy = {
          x: lensX, y: lensY, z: lensZ,
          lx: lLookX, ly: lLookY, lz: lLookZ,
        }
        
        tl.to(proxy, {
          x: target.cX, y: target.cY, z: target.cZ,
          lx: target.lX, ly: target.lY, lz: target.lZ,
          duration: 1.0,
          ease: 'power2.out',
          onUpdate: () => {
            camera.position.set(proxy.x, proxy.y, proxy.z)
            camera.lookAt(proxy.lx, proxy.ly, proxy.lz)
          }
        })
      } else {
        // Orbit the camera along the barrel axis
        const startAngle = currentOrbitAngle.current
        let endAngle = targetRotY
        
        let diff = endAngle - startAngle
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        endAngle = startAngle + diff

        const proxy = { 
          angle: startAngle,
          pitch: currentDecPitch.current,
          lx: currentLookAt.current.x,
          ly: currentLookAt.current.y,
          lz: currentLookAt.current.z
        }
        tl.to(proxy, {
          angle: endAngle,
          pitch: targetPitch,
          lx: target.lX,
          ly: target.lY,
          lz: target.lZ,
          duration: 2.0,
          ease: 'power2.inOut',
          onUpdate: () => {
            currentOrbitAngle.current = proxy.angle
            currentDecPitch.current = proxy.pitch
            
            const cur = getCamLook(proxy.pitch, proxy.angle + Math.PI)
            
            camera.position.set(cur.cX, cur.cY, cur.cZ)
            // Smoothly animate the look target instead of snapping to it instantly
            camera.lookAt(proxy.lx, proxy.ly, proxy.lz)
            currentLookAt.current.set(proxy.lx, proxy.ly, proxy.lz)
          }
        })
      }
    }

    prevScene.current = scene
  }, [scene, telescopeRA, telescopeDec])

  return null
}

export default function ObservatoryScene() {
  return (
    <div className="fixed inset-0">
      <Canvas
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 5, 35], fov: 70, near: 0.01, far: 500 }}
        dpr={Math.min(window.devicePixelRatio, 2)}
        shadows
      >
        <Suspense fallback={null}>
          <Interior />
        </Suspense>

        <EntryCamera />

        <EffectComposer>
          <Bloom
            intensity={0.85}
            luminanceThreshold={0.28}
            luminanceSmoothing={0.85}
            blendFunction={BlendFunction.SCREEN}
          />
          <ChromaticAberration
            offset={new Vector2(0.0008, 0.0008)}
            radialModulation={false}
          />
          <Noise opacity={0.018} blendFunction={BlendFunction.ADD} />
          <Vignette eskil={false} offset={0.08} darkness={0.72} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
