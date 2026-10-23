import type { Edge, Node } from '@xyflow/react'
import { AI_INSTRUCTIONS } from '@shared/ai/aiInstructions'
import { summarizeAiFolderResult } from '@shared/ai/aiFolderResult'
import { showAlert } from './ui/alerts'
import { createProfile } from './conformance/createProfile'
import { acceleratorFor } from './commands'
import type { MenuBarItem, MenuBarMenu } from './MenuBar'
import { buildPaletteActions, type ExtraPaletteAction, type PaletteAction } from './paletteActions'
import type { AppPreferences } from './preferences/preferences'

// What the menus need from the canvas: values to label and disable items by, and the handlers
// they run. Every item reuses an existing handler unchanged — the menus are a way to reach
// actions, not a set of actions (ADR 0039).
export interface MenuInputs {
  preferences: Pick<AppPreferences, 'recentDiagrams' | 'recentDiagramsLimit' | 'aiFeaturesEnabled'>
  currentPath: string | null
  isDiagramPersona: boolean
  nodes: Node[]
  selectedNodes: Node[]
  selectedEdges: Edge[]
  canUndo: boolean
  canRedo: boolean
  diagnosticsCount: number
  referenceCount: number
  fitView: () => void
  handleNew: () => void
  handleOpen: () => Promise<void>
  handleOpenRecent: (path: string) => Promise<void>
  handleClearRecent: () => void
  handleSave: () => Promise<void>
  handleSaveAs: () => Promise<void>
  handleReload: () => Promise<void>
  handleClose: () => void
  setExportDialogFormat: (format: 'png' | 'svg') => void
  undo: () => void
  redo: () => void
  cutSelection: () => void
  copySelection: () => void
  pasteFromClipboard: () => void
  duplicateSelected: () => void
  selectAll: () => void
  reverseEdges: (ids: string[]) => void
  toggleStyleBrush: () => void
  pasteStyleToSelection: () => void
  toggleSearchOverlay: () => void
  toggleAlignDistributePanel: () => void
  toggleDiagnosticsPanel: () => void
  toggleChangesPanel: () => void
  toggleLayerPanel: () => void
  toggleReferencesPanel: () => void
  toggleStylePalettePanel: () => void
  toggleDiagramSettingsPanel: () => void
  togglePreferencesPanel: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setShortcutsDialogOpen: (open: boolean) => void
  setAboutDialogOpen: (open: boolean) => void
}

// Top menu bar (ADR 0039) — File/Edit/View/AI/Help, and the command palette (ADR 0100) built from
// it. Mode-aware (ADR 0079): the Security Matrix persona is still a render-only prototype with no
// Canvas-level actions (its controls live inside ThreatMatrixView), so "matrix" just hides what
// doesn't apply: the Edit menu, the diagram-specific View panels and the exports. File basics,
// Preferences and About are shared. Matrix-specific menus come back once the matrix has persisted
// state to act on.
//
// Named use* only so the React lint accepts ref-backed event handlers being passed in; it holds no
// state.
export function useMenus(inputs: MenuInputs): {
  menus: MenuBarMenu[]
  paletteActions: PaletteAction[]
} {
  const {
    preferences,
    currentPath,
    isDiagramPersona,
    nodes,
    selectedNodes,
    selectedEdges,
    canUndo,
    canRedo,
    diagnosticsCount,
    referenceCount,
    fitView,
    handleNew,
    handleOpen,
    handleOpenRecent,
    handleClearRecent,
    handleSave,
    handleSaveAs,
    handleReload,
    handleClose,
    setExportDialogFormat,
    undo,
    redo,
    cutSelection,
    copySelection,
    pasteFromClipboard,
    duplicateSelected,
    selectAll,
    reverseEdges,
    toggleStyleBrush,
    pasteStyleToSelection,
    toggleSearchOverlay,
    toggleAlignDistributePanel,
    toggleDiagnosticsPanel,
    toggleChangesPanel,
    toggleLayerPanel,
    toggleReferencesPanel,
    toggleStylePalettePanel,
    toggleDiagramSettingsPanel,
    togglePreferencesPanel,
    setCommandPaletteOpen,
    setShortcutsDialogOpen,
    setAboutDialogOpen
  } = inputs
  const hasSelectedNodes = selectedNodes.length > 0

  // File -> Recent Diagrams submenu — labelled with the last two path
  // segments (…/parent/name.chd), enough to tell two same-named diagrams in
  // different folders apart without the full path. Empty list -> the parent
  // item is present but disabled, so its absence never reads as a bug.
  // Sliced here too, not just in normalizePreferences — lowering the limit
  // in Preferences should shorten the menu immediately, before the next
  // full preferences reload normalizes the stored list.
  const recentDiagrams = (preferences.recentDiagrams ?? []).slice(
    0,
    Math.max(1, preferences.recentDiagramsLimit)
  )
  const recentDiagramsItem: MenuBarItem =
    recentDiagrams.length === 0
      ? { label: 'Recent Diagrams', disabled: true }
      : {
          label: 'Recent Diagrams',
          submenu: [
            ...recentDiagrams.map((path) => ({
              label: path.split(/[\\/]/).slice(-2).join('/') || path,
              title: path,
              disabled: path === currentPath,
              onSelect: () => handleOpenRecent(path)
            })),
            { label: 'Clear Recent', separatorBefore: true, onSelect: handleClearRecent }
          ]
        }

  const preferencesItem: MenuBarItem = { label: 'Preferences', onSelect: togglePreferencesPanel }

  const fileMenu: MenuBarMenu = {
    label: 'File',
    items: [
      { label: 'New', accelerator: acceleratorFor('file.new'), onSelect: handleNew },
      { label: 'Open…', accelerator: acceleratorFor('file.open'), onSelect: handleOpen },
      recentDiagramsItem,
      { label: 'Save', accelerator: acceleratorFor('file.save'), onSelect: handleSave },
      { label: 'Save As…', accelerator: acceleratorFor('file.saveAs'), onSelect: handleSaveAs },
      // Diagram-only for now — a "export the matrix as PNG" may make sense
      // later but isn't built.
      ...(isDiagramPersona
        ? [
            {
              label: 'Export as PNG…',
              disabled: nodes.length === 0,
              onSelect: () => setExportDialogFormat('png')
            },
            {
              label: 'Export as SVG…',
              disabled: nodes.length === 0,
              onSelect: () => setExportDialogFormat('svg')
            }
          ]
        : []),
      {
        label: 'New conformance profile…',
        separatorBefore: true,
        onSelect: () => void createProfile()
      },
      { label: 'Reload', disabled: !currentPath, onSelect: handleReload },
      { label: 'Close', accelerator: acceleratorFor('file.close'), onSelect: handleClose }
    ]
  }

  const editMenu: MenuBarMenu = {
    label: 'Edit',
    items: [
      {
        label: 'Undo',
        accelerator: acceleratorFor('edit.undo'),
        disabled: !canUndo,
        onSelect: undo
      },
      {
        label: 'Redo',
        accelerator: acceleratorFor('edit.redo'),
        disabled: !canRedo,
        onSelect: redo
      },
      {
        label: 'Cut',
        accelerator: acceleratorFor('edit.cut'),
        disabled: !hasSelectedNodes,
        onSelect: cutSelection
      },
      {
        label: 'Copy',
        accelerator: acceleratorFor('edit.copy'),
        disabled: !hasSelectedNodes,
        onSelect: copySelection
      },
      // Not disabled on an empty/invalid clipboard — same silent no-op
      // as the keyboard shortcut, avoids a synchronous clipboard read on
      // every render just to compute this menu's enabled state.
      { label: 'Paste', accelerator: acceleratorFor('edit.paste'), onSelect: pasteFromClipboard },
      {
        label: 'Align / Distribute…',
        disabled: selectedNodes.length < 2,
        onSelect: toggleAlignDistributePanel
      },
      {
        // Reaches the same action as the edge context menu's "Reverse
        // direction" (ADR 0087), for a selection made by box-select or
        // "Select all edges" where a right-click on one edge isn't the
        // natural gesture.
        label:
          selectedEdges.length > 1
            ? `Reverse edge direction (${selectedEdges.length})`
            : 'Reverse edge direction',
        disabled: selectedEdges.length === 0,
        onSelect: () => reverseEdges(selectedEdges.map((e) => e.id))
      }
    ]
  }

  const commandPaletteItem: MenuBarItem = {
    label: 'Command palette…',
    accelerator: acceleratorFor('view.commandPalette'),
    onSelect: () => setCommandPaletteOpen(true)
  }

  const viewMenu: MenuBarMenu = {
    label: 'View',
    items: isDiagramPersona
      ? [
          commandPaletteItem,
          {
            label: `Diagnostics${diagnosticsCount > 0 ? ` (${diagnosticsCount})` : ''}`,
            onSelect: toggleDiagnosticsPanel
          },
          {
            label: 'Changes since last save…',
            accelerator: acceleratorFor('view.changesSinceLastSave'),
            onSelect: toggleChangesPanel
          },
          { label: 'Layers', onSelect: toggleLayerPanel },
          {
            label: `References${referenceCount > 0 ? ` (${referenceCount})` : ''}`,
            onSelect: toggleReferencesPanel
          },
          { label: 'Style Palette', onSelect: toggleStylePalettePanel },
          { label: 'Diagram settings', onSelect: toggleDiagramSettingsPanel },
          preferencesItem
        ]
      : [commandPaletteItem, preferencesItem]
  }

  const helpMenu: MenuBarMenu = {
    label: 'Help',
    items: [
      { label: 'Keyboard shortcuts…', onSelect: () => setShortcutsDialogOpen(true) },
      { label: 'About', onSelect: () => setAboutDialogOpen(true) }
    ]
  }

  // AI menu (ADR 0103): between View and Help; hidden by the
  // `aiFeaturesEnabled` preference, and omitted rather than rendered empty
  // when it has no items.
  const aiMenuItems: MenuBarItem[] = [
    {
      label: 'Enable AI assistance in a folder…',
      onSelect: () => {
        window.api
          .enableAiInFolder()
          .then((result) => {
            if (result) showAlert(summarizeAiFolderResult(result))
          })
          .catch((err) =>
            showAlert(
              `Could not set up AI assistance: ${err instanceof Error ? err.message : String(err)}`
            )
          )
      }
    },
    // Claude Desktop exists for Windows and macOS only (ADR 0110).
    ...(window.api.platform === 'win32' || window.api.platform === 'darwin'
      ? [
          {
            label: 'Install Claude Desktop extension…',
            onSelect: () => {
              window.api
                .installClaudeExtension()
                .catch((err) =>
                  showAlert(
                    `Could not install the Claude Desktop extension: ${err instanceof Error ? err.message : String(err)}`
                  )
                )
            }
          }
        ]
      : []),
    {
      label: 'Copy AI instructions',
      onSelect: () => {
        window.api.copyToClipboard(AI_INSTRUCTIONS)
        // The dialog's Copy button re-copies the instructions, not this
        // confirmation text (ADR 0104).
        showAlert(
          'Copied the AI instructions to your clipboard. Paste them into a chat with Claude (or another AI assistant), then attach or paste your .chd file.',
          AI_INSTRUCTIONS
        )
      }
    }
  ]
  const aiMenu: MenuBarMenu | null =
    preferences.aiFeaturesEnabled && aiMenuItems.length > 0
      ? {
          label: 'AI',
          // Always visible when the menu is open (ADR 0103): anything an assistant
          // reads is sent to its provider.
          notice: 'Could cause data leaks: what an AI assistant reads is sent to its provider.',
          items: aiMenuItems
        }
      : null

  const menus: MenuBarMenu[] = [
    fileMenu,
    ...(isDiagramPersona ? [editMenu] : []),
    viewMenu,
    ...(aiMenu ? [aiMenu] : []),
    helpMenu
  ]

  // Command palette (ADR 0100): every menu leaf above, flattened, plus the
  // few keyboard-only actions that have a real handler but no menu item of
  // their own (see the ADR for why exactly these six).
  const extraPaletteActions: ExtraPaletteAction[] = isDiagramPersona
    ? [
        {
          id: 'edit.duplicate',
          title: 'Duplicate selection',
          category: 'Edit',
          shortcut: acceleratorFor('edit.duplicate'),
          run: duplicateSelected
        },
        {
          id: 'selection.selectAll',
          title: 'Select everything',
          category: 'Selection',
          shortcut: acceleratorFor('selection.selectAll'),
          run: selectAll
        },
        {
          id: 'style.copy',
          title: 'Copy style',
          category: 'Style',
          shortcut: acceleratorFor('style.copy'),
          run: toggleStyleBrush
        },
        {
          id: 'style.paste',
          title: 'Apply copied style to selection',
          category: 'Style',
          shortcut: acceleratorFor('style.paste'),
          run: pasteStyleToSelection
        },
        {
          id: 'view.fit',
          title: 'Fit the whole diagram in view',
          category: 'View',
          shortcut: acceleratorFor('view.fit'),
          run: fitView
        },
        {
          id: 'search.toggle',
          title: 'Open or close search',
          category: 'Search',
          shortcut: acceleratorFor('search.toggle'),
          run: toggleSearchOverlay
        }
      ]
    : []
  const paletteActions = buildPaletteActions(menus, extraPaletteActions)
  return { menus, paletteActions }
}
