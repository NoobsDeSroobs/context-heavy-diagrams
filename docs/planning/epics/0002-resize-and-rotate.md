# 0002: Resize and rotate

## Status
Not Started

## Goal
Custom nodes are resizable and rotatable via direct mouse interaction (drag handles), not just programmatically. Also where nodes get more than the default's two fixed connection points, since that requires the same custom node component.

## Tasks
- [ ] Custom node component replacing the React Flow default
- [ ] `NodeResizer` wired up for drag-to-resize
- [ ] Rotation handle + CSS transform, following React Flow's rotatable-node pattern
- [ ] Multiple/configurable connection points (`Handle` components) on the custom node — default node only has one source + one target handle, flagged as a limitation during epic 0001 testing
- [ ] Confirm resize/rotate persist correctly through the `diagram.json` save/load from epic 0001
