type JsonObject = Record<string, unknown>;

const UiTextDefaults = {
  app: {
    brandTitle: ''
  },
  language: {
    label: '',
    ariaLabel: '',
    english: '',
    hungarian: ''
  },
  infoOverlay: {
    ariaLabel: '',
    triggerAriaLabel: '',
    title: '',
    items: [] as string[]
  },
  debugPanel: {
    summary: ''
  },
  clock: {
    sectionTitle: '',
    brandAriaLabel: '',
    logoAlt: '',
    black: '',
    white: '',
    reset: '',
    start: '',
    pause: ''
  },
  status: {
    showPossibleMovesTitle: '',
    showPossibleMovesAriaLabel: '',
    showMoves: '',
    clearHighlightsTitle: '',
    clearHighlightsAriaLabel: '',
    clearHighlights: '',
    startNewGameTitle: '',
    startNewGameAriaLabel: '',
    newGame: '',
    offerDrawTitle: '',
    offerDrawAriaLabel: '',
    offerDraw: '',
    acceptDrawTitle: '',
    acceptDrawAriaLabel: '',
    acceptDraw: '',
    declineDrawTitle: '',
    declineDrawAriaLabel: '',
    declineDraw: '',
    claimDrawTitle: '',
    claimDrawAriaLabel: '',
    claimDraw: '',
    whiteResignTitle: '',
    whiteResignAriaLabel: '',
    blackResignTitle: '',
    blackResignAriaLabel: '',
    white: '',
    black: '',
    drawFallback: '',
    toMoveSuffix: '',
    checkmatePrefix: ''
  },
  resignConfirm: {
    dialogAriaLabel: '',
    titleTemplate: '',
    cancelTitle: '',
    cancelAriaLabel: '',
    cancel: '',
    confirmTitle: '',
    confirmAriaLabel: '',
    confirm: ''
  },
  promotion: {
    sectionTitle: '',
    promoteToRookTitle: '',
    promoteToRookAriaLabel: '',
    rook: '',
    promoteToBishopTitle: '',
    promoteToBishopAriaLabel: '',
    bishop: '',
    promoteToKnightTitle: '',
    promoteToKnightAriaLabel: '',
    knight: '',
    promoteToQueenTitle: '',
    promoteToQueenAriaLabel: '',
    queen: ''
  },
  magicToolkit: {
    sectionTitle: '',
    myThreatsTitle: '',
    myThreatsAriaLabel: '',
    mine: '',
    myProtectedTitle: '',
    myProtectedAriaLabel: '',
    safe: '',
    enemyThreatsTitle: '',
    enemyThreatsAriaLabel: '',
    enemy: '',
    enemyProtectedTitle: '',
    enemyProtectedAriaLabel: '',
    guarded: ''
  },
  magicerToolkit: {
    sectionTitle: '',
    myHangingTitle: '',
    myHangingAriaLabel: '',
    blunder: '',
    enemyHangingTitle: '',
    enemyHangingAriaLabel: '',
    target: '',
    forkIdeasTitle: '',
    forkIdeasAriaLabel: '',
    fork: '',
    pinIdeasTitle: '',
    pinIdeasAriaLabel: '',
    pin: ''
  },
  gameTools: {
    sectionTitle: '',
    flipBoardTitle: '',
    flipBoardAriaLabel: '',
    flip: '',
    exportPgnTitle: '',
    exportPgnAriaLabel: '',
    exportImageTitle: '',
    exportImageAriaLabel: '',
    image: '',
    exportFenTitle: '',
    exportFenAriaLabel: ''
  },
  recognition: {
    sectionTitle: '',
    openingLabel: '',
    endgameLabel: '',
    suggestedLabel: '',
    waitingForOpening: '',
    loadingOpenings: '',
    noOpeningMatch: '',
    likelyEndgame: '',
    transitionPhase: '',
    notEndgameYet: ''
  },
  history: {
    sectionTitle: '',
    undoTitle: '',
    undoAriaLabel: '',
    undo: '',
    redoTitle: '',
    redoAriaLabel: '',
    redo: ''
  },
  cct: {
    capturesRowTitle: '',
    capturesIconTitle: '',
    noCapturesTitle: '',
    checksRowTitle: '',
    checksIconTitle: '',
    noChecksTitle: '',
    threatsRowTitle: '',
    threatsIconTitle: '',
    noThreatsTitle: ''
  },
  message: {
    gameOverNoMoves: '',
    gameOverStartNew: '',
    noPieceOnSquare: '',
    drawByAgreementText: '',
    drawByAgreementTitle: '',
    drawByThreefoldText: '',
    drawByThreefoldTitle: '',
    drawByFiftyMoveText: '',
    drawByFiftyMoveTitle: '',
    drawByStalemateText: '',
    drawByStalemateTitle: '',
    drawByInsufficientText: '',
    drawByInsufficientTitle: '',
    drawByFivefoldText: '',
    drawByFivefoldTitle: '',
    drawBySeventyFiveText: '',
    drawBySeventyFiveTitle: '',
    checkmateCallout: '',
    turnMessageTemplate: '',
    noLegalTargetsTemplate: '',
    checkmateWinner: '',
    resigns: '',
    resignsNoPeriod: '',
    forfeitsOnTime: '',
    forfeitsOnTimeNoPeriod: '',
    mockExportPgnReady: '',
    mockExportImageReady: '',
    mockExportFenCopied: '',
    mockForkIdeas: '',
    mockPinIdeas: '',
    openingPrefix: '',
    matchedStepsPrefix: '',
    linePrefix: '',
    bookRecommendationPrefix: '',
    bookRecommendationNowSuffix: '',
    bookRecommendationAfterSuffix: '',
    notesPrefix: ''
  }
};

export const UiText = cloneUiTextDefaults();

export function mergeUiText(source: JsonObject): void {
  deepAssign(UiText as unknown as JsonObject, source);
}

export function resetUiText(): void {
  deepAssign(UiText as unknown as JsonObject, cloneUiTextDefaults() as unknown as JsonObject);
}

function cloneUiTextDefaults(): typeof UiTextDefaults {
  return JSON.parse(JSON.stringify(UiTextDefaults)) as typeof UiTextDefaults;
}

function deepAssign(target: JsonObject, source: JsonObject): void {
  Object.keys(source).forEach((key) => {
    const srcValue = source[key];
    const tgtValue = target[key];

    if (Array.isArray(srcValue)) {
      target[key] = [...srcValue];
      return;
    }

    if (isObject(srcValue)) {
      if (!isObject(tgtValue)) {
        target[key] = {};
      }
      deepAssign(target[key] as JsonObject, srcValue);
      return;
    }

    target[key] = srcValue;
  });
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
