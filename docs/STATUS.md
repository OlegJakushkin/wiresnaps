# Implementation status

This repository is a working development milestone, **not completion of the
full WireSnaps specification**. The full-release Docker target must remain red
until the catalogue and validation gates below are complete.

## Working

- 82 files from the pinned SimulIDE electrical solver/component library and 282
  bundled MCU files have recorded input/output hashes. Product compilation has
  no Qt dependency. Standard containers, explicit contexts, deterministic pin
  ordering, bounded expression evaluation and structured solver errors replace
  desktop services. Network debugging, serial ports and dynamic plugins are not
  in the product build.
- Native shared C ABI and single-threaded WebAssembly builds; the same C++
  fixtures run natively, in Node and in browser diagnostics. Native sanitizer
  tests cover the exercised solver and MCU paths.
- Actual simavr ATmega328P and gpsim PIC16F877A execution, memory HEX loading,
  timers, interrupts, ADC, PWM, GPIO and serial. Docker-built bytecode runtime
  firmware executes compiler output through real emulated GPIO. Output loading
  draws current from the circuit's supply.
- Battery resistance/protection, lamp heating and open-filament failure, motor
  inductance/back EMF/inertia/heating/generation, diode/BJT loading and persistent
  virtual failures. Guided intervention and experiment mode share these models.
- React/TypeScript/Three workbench with original procedural geometry, stacked
  snaps, explicit wires, selection, movement, rotation, layer view, undo/redo,
  local persistence and project import/export. Blockly, local compilation,
  authored guidance and fixed-interval Rapier motor coupling are present.
- Static export, local runtime dependencies, diagnostic runner, source archive,
  dependency notices and whole-distribution byte accounting.
- Shared compound geometry for all 55 exposed definitions, conservative body
  collision checks, reserved rotor clearance, explicit layer previews, assembly
  moves and undoable drag-to-library deletion. Imported overlaps are retained and
  blocked from running. Rounded procedural plastic plates remain in the renderer.
- Electrical markings and separate provenance-backed Snap Circuits/Znatok naming
  tables. Current manufacturer mappings are functional equivalents; no measured
  hardware construction match is claimed. None is the default naming preset.
- Direct mouse/touch switches and buttons, visible dial handles, keyboard
  operation, brighter emission, blue Dark Night, Auto/High/Low quality, contact
  shadows, bloom and restrained depth of field. Dark Night also removes ambient
  sunlight from solar and light-sensor models, retaining the chosen daylight
  setting for restoration and saved-project reloads.
- Startup shader preparation for every supported spill-light count and quality
  path, with retained programs across project changes and component deletion.
  Ordinary projects run automatically; live rewiring retains physical time,
  reactive energy, heat, damage, motor motion and AVR/PIC execution. A lifted
  connector disconnects until dropped or cancelled. Manual pause, Guided stops,
  invalid-construction stops and paused Breakage Lab openings remain available.
- Filament brightness follows a visible-band temperature model with a short
  afterglow; weak infrared cooling is no longer amplified into visible light.
  Thermal constants remain labelled educational estimates.
- IndexedDB My Projects, versioned conflict copies, legacy migration with backup,
  save/copy/rename/delete, thumbnails, import/export and persistent damage.
  Project identity and load generation reject stale worker observations.
- A compact "Try next" panel after choosing or placing a part, with up to four
  context-aware candidates, voltage-aware LED protection ideas, and explanations
  on hover, keyboard focus or touch. Selecting an idea uses normal placement.
- Fourteen starter showcases (two per group, including real AVR/PIC circuit and
  block projects), five additional gear/relay/NPN/PNP/complementary-transistor
  explorations, six single-transistor sensor/timer/fan lessons (three NPN and
  three PNP), and four labelled destructive virtual experiments. Templates
  prefer real snap connectors and retain flexible wires only where routing needs
  them. Automated fixtures check every template's clearance and electrical result,
  guided intervention, damage persistence and both editable block workspaces.

- Body-aware automatic snap/cable routing, hover/selection conductor tracing,
  Krona 9 V geometry, supported gear ratios with reflected mechanical loads,
  five-terminal changeover relays, and repeated on/off project checks. See
  [clear-wiring notes](CLEAR_WIRING.md) for hardware mapping evidence and limits.
- Flexible-wire endpoint editing: first select the cable, then drag a blue or
  gold handle to a compatible snap. The component never moves. The cable is
  electrically unplugged during the drag; cancellation restores it, and a valid
  drop makes one undoable edit. Rounded cable bends, eased motion, touch targets,
  reduced-motion support and keyboard-accessible endpoint selectors are included.
  Specific snaps on multi-snap strips survive save/load and JSON export.

## Incomplete gates

1. **Catalogue:** the collection contains 329 candidate part numbers. It has not
   been certified exhaustive. Unnumbered accessories, discontinued-kit coverage,
   noisy extracted names and cosmetic aliases still require manual review.
   The workbench exposes 55 definitions, including two independent educational
   extensions. These are not 55 hardware-validated models. The coverage manifest
   deliberately retains `inventoryComplete: false` and review statuses.
2. **Extraction coverage:** not every electrical peripheral originally embedded
   in a SimulIDE GUI class is exposed through the C ABI. Only the two named MCU
   profiles have executable verification. Other imported processor families and
   digital peripherals are not advertised as verified devices.
3. **Baseline:** analytic fixtures characterize the extracted core. A separately
   executed pristine-upstream characterization baseline and broad import of
   upstream example circuits remain to be added; do not equate the present
   fixtures with that requested baseline.
4. **Hardware fidelity:** proprietary sound/recording/radio modules, all catalogue
   sensors, transformers and power modules are not implemented. Model constants
   need per-part datasheet/manual evidence and calibration. Current temperature
   and damage thresholds are educational estimates, not hardware validation.
5. **Construction:** current movement uses a fixed board, layers and quarter-turn
   rotation. Complete vertical construction, matching snap orientations, precise
   measured hardware body geometry, freely oriented boards, gear trains, belts, vehicles
   and every accessory are incomplete. Rapier currently couples motor rotors and
   attached inertial loads; it is not a complete mechanical assembly system.
6. **Programming/guidance:** proprietary programmable-module backends, complete
   block-by-block stepping and all translations remain. Timing advances in fixed physical steps. Numeric
   arithmetic currently uses unsigned bytes and wraps modulo 256.
7. **Release verification:** individual catalogue behavior/polarity/overload
   matrices, exhaustive MCU peripheral tests, measured 60 FPS/<100 ms response
   on an agreed hardware reference machine and exhaustive offline recovery
   scenarios remain. Docker browser reports measure software rendering and test
   IndexedDB migration, conflicts, quota errors and project recovery; those do not
   establish universal hardware performance or full catalogue certification.

`docker/Dockerfile` provides `milestone-export` for review and `release-export`
for the final product. `tools/check_release.py` rejects a full release while
the above catalogue audit remains incomplete. Do not bypass that gate to label
this milestone complete.
