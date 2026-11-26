import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Story, StoryAction, VisibilitySet } from '@shared/diagram'
import {
  hiddenAtStep,
  newStoryId,
  storyFromSets,
  withAction,
  withActionChanged,
  withActionMoved,
  withoutAction
} from '@shared/visibility/story'
import { nameTaken } from '@shared/visibility/visibility'
import type { CanvasApi } from '../canvas/canvasApi'

export interface StoriesState {
  // The story the panel is on: the one picked, or the first.
  story: Story | null
  selectStory: (id: string) => void
  // The step the editor shows on the canvas: 0 is before the first step (ADR 0194).
  step: number
  selectStep: (step: number) => void
  // Both return why the name was refused, or null when it was taken (a name is unique, ignoring case).
  addStory: (name: string) => string | null
  renameStory: (id: string, name: string) => string | null
  deleteStory: (id: string) => void
  addStep: () => void
  duplicateStep: () => void
  deleteStep: () => void
  moveStep: (from: number, to: number) => void
  // The actions of step `index` (1 is the first, 0 the start state); an action is told apart by its place
  // (0-based). A new action is a Show of the first set the step does not name yet.
  addAction: (index: number) => void
  changeAction: (index: number, at: number, change: Partial<StoryAction>) => void
  removeAction: (index: number, at: number) => void
  moveAction: (index: number, from: number, to: number) => void
  fromSets: () => void
  presenting: boolean
  // The step the presenter is on, 0 to the number of steps.
  presentStep: number
  present: () => void
  leave: () => void
  goTo: (step: number) => void
  next: () => void
  previous: () => void
  // The presenter's keys. True when the key was one of them (and the presenter is on), so the caller
  // prevents its default. While presenting the caller runs no other shortcut.
  handlePresenterKey: (event: KeyboardEvent) => boolean
  // A diagram was opened: what belongs to the old one goes.
  reset: () => void
}

// Stories (ADR 0194). The stories are file content and live in the canvas next to the sets; which
// step is on screen is session state and never saved. A story only drives which sets are hidden,
// so what it draws goes through the one rule of ADR 0194, and the editor's preview and the presenter
// are the same thing seen from two places. The editor previews a step only while its panel is open
// (`panelOpen`): closing the panel puts the hidden sets back as they were before the preview.
export function useStories(
  { setNodes, setEdges, markDirty }: CanvasApi,
  stories: Story[],
  setStories: React.Dispatch<React.SetStateAction<Story[]>>,
  visibilitySets: VisibilitySet[],
  hiddenSetIds: Set<string>,
  setHidden: (hidden: Set<string>) => void,
  panelOpen: boolean
): StoriesState {
  const [storyId, setStoryId] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [presenting, setPresenting] = useState(false)
  const [presentStep, setPresentStep] = useState(0)
  // The sets that were hidden before the presenter started, put back when it ends.
  const beforePresenting = useRef<Set<string> | null>(null)

  const story = useMemo(
    () => stories.find((s) => s.id === storyId) ?? stories[0] ?? null,
    [stories, storyId]
  )

  // Shows the state of a story at a step on the canvas.
  const show = useCallback(
    (of: Story | null, at: number) => {
      if (of) setHidden(hiddenAtStep(of, visibilitySets, at))
    },
    [setHidden, visibilitySets]
  )

  // What was hidden before the editor began to preview, put back when the panel closes. Null while
  // nothing is being previewed.
  const beforePreview = useRef<Set<string> | null>(null)
  // The editor's preview: shows a step and remembers what was hidden before the first one.
  const preview = useCallback(
    (of: Story | null, at: number) => {
      if (!of) return
      if (beforePreview.current === null) beforePreview.current = new Set(hiddenSetIds)
      show(of, at)
    },
    [hiddenSetIds, show]
  )
  // The panel opens: the step the editor is on is previewed. It closes: the sets are put back. Both
  // wait for the presenter, which has its own way back (see `leave`).
  const wasOpen = useRef(false)
  useEffect(() => {
    const opened = panelOpen && !wasOpen.current
    wasOpen.current = panelOpen
    if (presenting) return
    if (opened) preview(story, step)
    if (!panelOpen && beforePreview.current) {
      setHidden(beforePreview.current)
      beforePreview.current = null
    }
  }, [panelOpen, presenting, story, step, preview, setHidden])

  const selectStory = useCallback(
    (id: string) => {
      setStoryId(id)
      setStep(0)
      preview(stories.find((s) => s.id === id) ?? null, 0)
    },
    [stories, preview]
  )

  const selectStep = useCallback(
    (at: number) => {
      if (!story) return
      const clamped = Math.max(0, Math.min(at, story.steps.length))
      setStep(clamped)
      preview(story, clamped)
    },
    [story, preview]
  )

  // Replaces one story, marks the file changed and shows the step the editor is on.
  const edit = useCallback(
    (changed: Story, at: number) => {
      setStories((prev) => prev.map((s) => (s.id === changed.id ? changed : s)))
      markDirty()
      setStep(at)
      preview(changed, at)
    },
    [setStories, markDirty, preview]
  )

  const addStory = useCallback(
    (name: string): string | null => {
      const trimmed = name.trim()
      if (!trimmed) return 'A story needs a name.'
      if (nameTaken(stories, trimmed)) return `A story named "${trimmed}" already exists.`
      const made: Story = { id: newStoryId(stories), name: trimmed, steps: [] }
      setStories((prev) => [...prev, made])
      markDirty()
      setStoryId(made.id)
      setStep(0)
      preview(made, 0)
      return null
    },
    [stories, setStories, markDirty, preview]
  )

  const renameStory = useCallback(
    (id: string, name: string): string | null => {
      const trimmed = name.trim()
      if (!trimmed) return 'A story needs a name.'
      if (nameTaken(stories, trimmed, id)) return `A story named "${trimmed}" already exists.`
      setStories((prev) =>
        prev.map((s) => (s.id === id && s.name !== trimmed ? { ...s, name: trimmed } : s))
      )
      markDirty()
      return null
    },
    [stories, setStories, markDirty]
  )

  const deleteStory = useCallback(
    (id: string) => {
      const doomed = stories.find((s) => s.id === id)
      if (!doomed) return
      if (
        doomed.steps.length > 0 &&
        !confirm(`Delete the story "${doomed.name}" and its ${doomed.steps.length} step(s)?`)
      ) {
        return
      }
      setStories((prev) => prev.filter((s) => s.id !== id))
      markDirty()
      setStoryId(null)
      setStep(0)
    },
    [stories, setStories, markDirty]
  )

  // A new step goes after the one the editor is on (at the start when it is on Start), and is the one
  // shown, so it can be filled in at once.
  const addStep = useCallback(() => {
    if (!story) return
    const steps = [...story.steps]
    steps.splice(step, 0, {})
    edit({ ...story, steps }, step + 1)
  }, [story, step, edit])

  const duplicateStep = useCallback(() => {
    if (!story || step < 1) return
    const source = story.steps[step - 1]
    const steps = [...story.steps]
    steps.splice(step, 0, source.actions ? { actions: source.actions.map((a) => ({ ...a })) } : {})
    edit({ ...story, steps }, step + 1)
  }, [story, step, edit])

  const deleteStep = useCallback(() => {
    if (!story || step < 1) return
    const steps = story.steps.filter((_, i) => i !== step - 1)
    edit({ ...story, steps }, Math.min(step, steps.length))
  }, [story, step, edit])

  // Moves step `from` to place `to` (both 1-based) and follows it.
  const moveStep = useCallback(
    (from: number, to: number) => {
      if (!story) return
      const count = story.steps.length
      if (from < 1 || from > count || to < 1 || to > count || from === to) return
      const steps = [...story.steps]
      const [moved] = steps.splice(from - 1, 1)
      steps.splice(to - 1, 0, moved)
      edit({ ...story, steps }, to)
    },
    [story, edit]
  )

  // Changes one step of the story picked and keeps the editor on it.
  const editStep = useCallback(
    (index: number, change: (step: Story['steps'][number]) => Story['steps'][number]) => {
      if (!story || index < 0 || index > story.steps.length) return
      if (index === 0) {
        // The start state: kept in the story only while it has actions.
        const start = change(story.start ?? {})
        const rest = { ...story }
        delete rest.start
        edit(start.actions?.length ? { ...rest, start } : rest, 0)
        return
      }
      const steps = story.steps.map((s, i) => (i === index - 1 ? change(s) : s))
      edit({ ...story, steps }, index)
    },
    [story, edit]
  )

  const addAction = useCallback(
    (index: number) => {
      if (visibilitySets.length === 0) return
      editStep(index, (step) => {
        const named = new Set((step.actions ?? []).map((a) => a.set))
        const set = visibilitySets.find((s) => !named.has(s.id)) ?? visibilitySets[0]
        return withAction(step, { action: 'show', set: set.id })
      })
    },
    [editStep, visibilitySets]
  )
  const changeAction = useCallback(
    (index: number, at: number, change: Partial<StoryAction>) =>
      editStep(index, (step) => withActionChanged(step, at, change)),
    [editStep]
  )
  const removeAction = useCallback(
    (index: number, at: number) => editStep(index, (step) => withoutAction(step, at)),
    [editStep]
  )
  const moveAction = useCallback(
    (index: number, from: number, to: number) =>
      editStep(index, (step) => withActionMoved(step, from, to)),
    [editStep]
  )

  const fromSets = useCallback(() => {
    if (!story) return
    if (
      story.steps.length > 0 &&
      !confirm(
        `Replace the ${story.steps.length} step(s) of "${story.name}" with one step per set?`
      )
    ) {
      return
    }
    edit({ ...story, steps: storyFromSets(visibilitySets) }, 0)
  }, [story, visibilitySets, edit])

  // The presenter. Entering shows step 0; the story's own sets start hidden, so the person sees
  // what the audience will, and leaving puts back what was hidden before: from before the editor's
  // preview, when there is one.
  const present = useCallback(() => {
    if (!story || presenting) return
    // With the panel open, what is hidden now is what the presenter returns to, so the editor can
    // put the sets back when the panel closes.
    if (panelOpen && beforePreview.current === null) beforePreview.current = new Set(hiddenSetIds)
    beforePresenting.current = new Set(beforePreview.current ?? hiddenSetIds)
    // Nothing is selectable in the presenter, so nothing stays selected either.
    setNodes((nds) =>
      nds.some((n) => n.selected) ? nds.map((n) => ({ ...n, selected: false })) : nds
    )
    setEdges((eds) =>
      eds.some((e) => e.selected) ? eds.map((e) => ({ ...e, selected: false })) : eds
    )
    setPresentStep(0)
    setPresenting(true)
    show(story, 0)
  }, [story, presenting, panelOpen, hiddenSetIds, setNodes, setEdges, show])

  const leave = useCallback(() => {
    if (!presenting) return
    setPresenting(false)
    // With the panel open the editor shows the step the presenter ended on; without it the sets go
    // back to what they were.
    if (panelOpen) {
      setStep(presentStep)
      show(story, presentStep)
    } else if (beforePresenting.current) {
      setHidden(beforePresenting.current)
      beforePreview.current = null
    }
    beforePresenting.current = null
  }, [presenting, presentStep, panelOpen, story, show, setHidden])

  const goTo = useCallback(
    (at: number) => {
      if (!story) return
      const clamped = Math.max(0, Math.min(at, story.steps.length))
      setPresentStep(clamped)
      show(story, clamped)
    },
    [story, show]
  )
  const next = useCallback(() => goTo(presentStep + 1), [goTo, presentStep])
  const previous = useCallback(() => goTo(presentStep - 1), [goTo, presentStep])

  const handlePresenterKey = useCallback(
    (event: KeyboardEvent): boolean => {
      if (!presenting || !story) return false
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'Enter':
          next()
          return true
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
          previous()
          return true
        case 'Home':
          goTo(0)
          return true
        case 'End':
          goTo(story.steps.length)
          return true
        case 'Escape':
          leave()
          return true
        default:
          return false
      }
    },
    [presenting, story, next, previous, goTo, leave]
  )

  const reset = useCallback(() => {
    setPresenting(false)
    beforePresenting.current = null
    beforePreview.current = null
    setStoryId(null)
    setStep(0)
    setPresentStep(0)
  }, [])

  return {
    story,
    selectStory,
    step,
    selectStep,
    addStory,
    renameStory,
    deleteStory,
    addStep,
    duplicateStep,
    deleteStep,
    moveStep,
    addAction,
    changeAction,
    removeAction,
    moveAction,
    fromSets,
    presenting,
    presentStep,
    present,
    leave,
    goTo,
    next,
    previous,
    handlePresenterKey,
    reset
  }
}
