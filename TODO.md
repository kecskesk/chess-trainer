# ChessBoardComponent Behavior Pushdown TODO

## Done
- [x] Move draw/resign availability UI logic into `ChessBoardStatusCardComponent`.
- [x] Move clock active/low indicator UI logic into `ChessBoardClockCardComponent`.
- [x] Simplify `ChessBoardComponent` template bindings by removing `clockVm` / `statusVm` indirection.
- [x] Move history-card timeline presentation state (`visibleHistory`, `canUndo`, `canRedo`) into `ChessBoardHistoryCardComponent`.
- [x] Extract board-square/display mapping and drag/drop board rendering into `ChessBoardGridComponent`.
- [x] Move PGN/FEN/image export orchestration into `ChessBoardExportFacade`.

## Next
- [ ] Move overlay tool toggling orchestration (`showThreats`, `showProtected`, `showHangingPieces`, `showForkIdeas`, `showPinIdeas`) into a focused facade/service with stateless inputs/outputs.
- [ ] Consolidate duplicated suggested-move style/score logic across tools and CCT cards into a shared utility.
- [ ] Reduce `ChessBoardComponent` public method surface that exists only for legacy tests and migrate tests to child/facade ownership.
