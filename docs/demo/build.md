# Build, connect, change your mind

The workbench treats a circuit as a collection of **bodies, terminals and
connections**. A wire touching a part in the picture is not enough: compatible
snaps must engage, or a flexible wire must explicitly join the terminals.

[Try Wire Flyover](../../?demo=wire-flyover#build) · [Try Lighthouse Tower](../../?demo=lighthouse#build)

## Start with three moves

1. Open a project or choose a part from the left library. Move it over the board
   and look for the placement preview.
2. Choose a valid position and layer. Rotate in quarter turns when needed.
   Battery cells, lamps, housings and rotor clearance all count as occupied space.
3. Operate the circuit directly: click a slide switch, hold a push button or move
   a dial. Normal projects run as soon as startup preparation finishes.

You can still Pause and advance a small simulation step. Invalid construction
and Guided protection also pause operation rather than showing invented results.

## Wiring you can follow

**Snap connectors first.** Demo layouts use rigid snap connectors where practical.
Long paths avoid covering the bodies of parts; complex routes may use flexible
cables to keep the circuit readable.

**Point to point.** Choose Join snaps, then choose the two terminals. The router
looks for a clear path. Flexible-wire mode draws a cable around solid bodies.
The tidy-wiring action can replace covering routes while keeping the circuit's
electrical connections; Undo restores the previous layout.

**Follow the whole path.** Hover over or select a connector or cable to highlight
its route to the nearest connected components. The terminal guide names the
connections so a long wire is easier to understand.

## Rewire a flexible cable

1. Click the cable once to select it. Its two coloured ends become handles.
2. Drag a handle to another compatible metal snap. The cable bends smoothly as
   you move it; the component underneath stays in place.
3. Release on the new snap. The circuit updates while it runs. Escape, a
   cancelled gesture or an invalid drop restores the previous connection.

During the drag, that cable end is electrically unplugged. Existing heat,
damage, capacitor state and matching MCU execution state are preserved when the
topology is rebuilt. You can also select endpoints from the accessible lists in
the guide. Each completed rewire is undoable.

## Space is part of the lesson

Use top view to inspect connections and exploded layers to understand a stack.
Mechanical attachments move with their parent assembly. Fan and wheel clearance
prevents other bodies from occupying a spinning part's space. Imported older
projects with overlaps are kept for repair and highlighted instead of silently
moving their parts.

The current board uses layers and quarter-turn rotations. Fully free 3D boards,
every vertical connector and arbitrary mechanical machines remain future work.

## Markings tell a story

| Marking | What to notice |
| --- | --- |
| Battery + and − | A source provides an electrical push between two ends. |
| LED A/K and polarity | Direction matters, and current still needs limiting. |
| Diode band | The band identifies the cathode; reversing a diode changes its behavior. |
| Transistor B, C, E | A base signal controls a collector-to-emitter path; NPN and PNP need different polarity. |
| Capacitor polarity | Larger polarised capacitors have a preferred orientation. |
| Values and ratings | Compare resistance, voltage and current limits with the live readings. |

Ordinary resistors, wires and switches have no invented positive and negative
ends. Selecting a part enlarges its markings and shows what it does and needs.

## Small conveniences that keep the idea moving

- **Undo / redo**, duplicate, rotate and zoom to the selected part.
- **Drag to delete:** throw a placed part into the left library. Its attachments,
  dependent connections and owned program are removed together and can be undone.
- **Next-part suggestions:** up to four useful candidates with a reason for each.
- **Keyboard:** R rotates, Delete removes, Space operates a selected switch or
  button, Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes, and Escape cancels a gesture.
- **Touch:** use the same direct controls; open Help & part controls for the
  smaller-screen guide.

## Keep your invention

My Projects lists saved inventions with thumbnails and dates. Open, rename,
duplicate or delete them; Save a Copy starts another version. Autosave includes
the circuit, controls, code, firmware, lesson progress, presentation and damage.
Conflicting writes from another tab create a separate copy instead of silently
overwriting work. Export/import JSON to move a project between devices.

Browser storage can be cleared by the browser or user. A JSON export is your
portable backup; storage errors are shown explicitly.

## Compare with parts you own

Optional Snap Circuits and Znatok labels show reference codes and terminal
identification. The default uses original WireSnaps labels. Naming never changes
the electrical model. Reference mappings are functional comparisons, with
estimates and unverified details called out; they are not certified physical
construction instructions. Znatok numbering currently relies on a secondary
manual reference. [Read the naming and rights notes](rights.md).
