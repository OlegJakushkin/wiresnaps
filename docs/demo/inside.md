# What makes the playground work

The website serves files. **Your browser runs the simulation.** No login,
application server, cloud compiler or shared-memory hosting headers are required.
All runtime libraries and firmware ship locally with the site.

## From a snap to a moving fan

1. **Authoring:** TypeScript, React and Three.js describe placed parts, their
   terminals, controls, connections and code. Shared component geometry is used
   for rendering and collision checks.
2. **Circuit loading:** a dedicated Web Worker translates the project into the
   engine's circuit description. Project identity, revision and load generation
   prevent old worker replies from affecting a newly opened project.
3. **Electrical solving:** the Qt-free C/C++ engine, extracted from pinned
   SimulIDE sources, runs as WebAssembly through a small C ABI. It calculates
   voltages, currents, reactive state, heat, limits and damage.
4. **Mechanical feedback:** every millisecond of simulated time, motor torque
   drives the Rapier rotor. Its speed feeds back into the motor's back EMF and
   electrical load.
5. **Presentation:** observations drive light emission, rotation, readings and
   condition indicators. Rendering has its own frame rate and never advances
   the physical clock by itself.

The default electrical step is **10 microseconds**. Work per advance call is
bounded. Slow hardware can simulate more slowly than real time; it reports that
speed instead of skipping physical time. Invalid or non-converging circuits
return diagnostics and stop at the last valid observation.

## Where the C++ code is involved

| Stage | What C++ does | What TypeScript does |
| --- | --- | --- |
| Construction | Receives the resulting circuit. | Validates bodies, builds connection nets and manages edits. |
| Electricity | Solves the network and component equations. | Sends controls and displays observations. |
| Heating and failure | Accumulates modelled thermal stress and changes failed conductors. | Explains failure and offers explicit replacement. |
| Programming | Runs simavr / gpsim instructions and electrically modelled MCU pins. | Edits Blockly JSON, compiles bytecode and packages runtime firmware. |
| Motion | Supplies electrical motor torque and uses returned speed. | Schedules the Rapier exchange in the worker and renders the result. |

Native and WebAssembly builds share the engine source and physics fixtures.
Firmware is supplied from memory; there is no desktop Qt interface, OS serial
connection, network debugger or dynamic plugin loader in the product build.

## Why an LED is not just an animation

A program changes a pin. The connected circuit determines current. The LED
model supplies brightness and heat observations. The renderer follows those
observations. Disconnecting the supply, reversing polarity, changing resistance
or damaging the part can alter the result while the same program keeps running.

Lamp resistance changes with temperature. Capacitors hold state between steps.
The motor includes inertia and back EMF. Rewiring preserves matching component
state, damage and MCU execution rather than starting a new animation from zero.

## Reproducible, inspectable builds

Docker builds the native engine, WebAssembly, AVR/PIC runtime firmware and static
website. Checks cover analytic electrical fixtures, template construction,
actual emulated controller behavior and browser interactions. C++ diagnostics,
licence notices and corresponding source accompany the distribution.

The export gate counts **every optional download** against 1,000,000,000 bytes.
The conservative compressed runtime bound must remain below 20 MB. A separate
full-release gate stays closed while catalogue coverage is incomplete.

## Honest limits

The catalogue currently exposes 55 definitions from an unfinished 329-candidate
inventory. It is not the entire catalogue. Parameters marked as estimates are
not measurements of a manufacturer's part. Proprietary radio/sound/recording
modules, broader MCU coverage, fully free spatial assemblies and exhaustive
hardware validation remain unfinished. The target of 60 FPS and under-100-ms
interaction is not a certification on every computer.

The software is **GPL-3.0-or-later**. The upstream SimulIDE revision is
`4bf26bc839147551a00938aa2949012681a3e046`; per-file provenance and inherited
licences accompany the source. [Read the names and rights notes](rights.md).
