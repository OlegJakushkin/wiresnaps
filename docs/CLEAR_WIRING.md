# Clear wiring and component demonstrations

All execution and validation for this change runs in Docker.

## Construction and rendering

Auto wire joins two selected snaps. It first tries low rigid snap paths, using
the same collision and electrical-net checks as manual construction. It will
not place a strip across the component face, PCB, control or printed value,
even when the strip is lower than the tallest feature. Only small windows
around metal snaps permit a connector to enter or leave a face.
Connections in authored templates form short trees instead of long stars.
When a clear rigid route cannot fit, an insulated cable follows an orthogonal
quarter-pitch path around bodies and labels. Cable heights clear solid shapes;
crossing cables do not electrically connect. Cable-only mode is also available.
Imported, obstructed endpoints retain their connections and use elevated cable
fallbacks; `data-obstructed-wires` in browser diagnostics counts these exceptions.
All shipped templates must have zero such exceptions.

Hovering or selecting either a rigid connector or a cable traces its entire
conducting net, including branches, stacks and the nearest component terminals.
The trace never crosses through a resistor, transistor, switch or another
functional component. Selected cable deletion is undoable. Rounded component
plates are retained. Saved layouts with obscuring connectors show **Tidy wires**.
This rebuilds the affected conducting paths with the same terminal connectivity,
keeping component identities, positions, controls, firmware and damage. Stacking
supports are retained; paths containing failed connectors are left intact so
tidying cannot bypass damage. The entire change can be undone;
there is no need to discard a saved project and start a fresh template.

The 9 V battery uses an original rectangular PP3/Krona silhouette and two
different terminals on the same end. Its approximate envelope is informed by
the [Energizer 522 dimension drawing](https://data.energizer.com/pdfs/522.pdf).
The snap carrier is a WireSnaps adaptation, not a measured B5 holder. The 5 V
controller supply now has a supply housing rather than AA cells.

## New projects and model changes

The original fourteen showcases and four breakage experiments remain. Five
additional construction projects are listed below; the six
[single-transistor lessons](TRANSISTOR_LESSONS.md) bring the collection to 29:

* Gear Buddies: a geared motor, a small gear and a larger gear on a bearing stand.
* Relay Light Swap: independent coil and lighting batteries, COM/NO/NC transfer.
* NPN Lantern: a low-side switch with base current limiting and a pull-down.
* PNP Lantern: a high-side switch with base current limiting and a pull-up.
* NPN + PNP Team: an NPN controls a PNP high-side LED switch.

Each has a directly clickable slide switch. Tiny Switch, Big Job keeps its
momentary button and adds a base pull-down; releasing it removes motor drive.
Motor inertia still permits coasting. Repeated on/off fixtures check the actual
electrical result, including both relay outputs and the PIC's PWM over a window
of physical time instead of sampling a single PWM edge.

The geared motor now declares estimated gearbox drag: 0.0002 N m s/rad viscous
friction and 0.003 N m dry friction at the output shaft, with 0.0002 kg m² inertia.
Both the native unloaded motor and Rapier-coupled train use dissipative friction
that reaches rest without numerical reversal. The example coasts for roughly
one simulated second after opening its switch; restoring power restarts it.
External driving torque can still overcome friction and generate electricity.
Motor angles retain complete revolutions so fractional gear ratios remain
continuous instead of jumping at every wrapped motor turn.

The engine accepts both legacy four-terminal relays and five-terminal SPDT
relays through the unchanged C ABI. Coil resistance and pickup current remain
estimates; inductance, contact bounce and mechanical pickup delay are not yet
represented. The transistor cutoff fix removes residual relaxed Norton stamps
when base current is zero, preventing impossible floating-collector voltages
and false Guided-mode interventions. Its imported-file hash and modification
record are in `provenance/core-port.json`.

Supported gears mesh only when their pitch circles and shaft heights match.
One Rapier rotor represents each ideal gear train; signed speed ratios reflect
torque and inertia into it on the fixed 1 ms mechanical schedule. Gear rendering
uses the same ratio and electrical motor angle. Blocking a driven gear stalls
the motor and raises electrical current and heating. Gear teeth, rounded hubs
and bearing stands are original procedural geometry. Backlash, tooth flex and
tooth breakage are not modelled.

## Hardware mapping evidence and limits

* [Elenco transistor manual](https://www.elenco.com/wp-content/uploads/2017/10/753285-2.pdf):
  Q2 NPN and Q1 PNP functions. Projects use 3 V, 100 Ω LED resistors, 1 kΩ base
  resistors and 10 kΩ off-state resistors. The combined circuit needs two each
  of the latter values; a single kit may need extra parts. Retain the external
  LED resistor even when the kit LED also has internal protection.
* [Elenco STEM manual, project 69, PDF page 62](https://www.elenco.com/wp-content/uploads/2017/05/SC_STEM1_manual_PRINT_Small.pdf#page=62):
  relay contacts 1 COM, 2 NC and 3 NO, isolated from the coil. The Snap Circuits
  naming preset includes these documented terminal numbers. Follow the actual
  relay's supply rating and pin layout; our dimensions and coil constants do
  not establish a verified physical construction match.
* [Elenco parts catalogue](https://www.elenco.com/wp-content/uploads/2022/02/Snap-Circuits_Order-Form.pdf):
  GEAR1 1-inch and GEAR2 1.75-inch outside diameters. Tooth counts 12/22, pitch
  diameters, bearings, adapters and friction are explicitly educational
  estimates. The generic bearing stand has no verified manufacturer mapping.

These are original, functionally mappable projects, not reproductions of
manufacturer project diagrams. Catalogue naming never changes engine behaviour.
The full-catalogue release gate remains incomplete as described in STATUS.md.
