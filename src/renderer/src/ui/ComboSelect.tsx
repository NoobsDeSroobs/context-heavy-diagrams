import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ComboOption<T extends string> {
  value: T
  label: string
  // Listed under a heading; options without one come first.
  group?: string
  // Extra words the option is found by besides its label (the BPMN terms of a stencil kind).
  terms?: string
}

interface Placement {
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
}

const LIST_MAX_HEIGHT = 260

function placementOf(input: HTMLElement): Placement {
  const rect = input.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - 8
  const above = rect.top - 8
  // Opens upwards when there is little room below and more above.
  if (below < 160 && above > below) {
    return {
      left: rect.left,
      width: rect.width,
      bottom: window.innerHeight - rect.top + 2,
      maxHeight: Math.min(LIST_MAX_HEIGHT, above)
    }
  }
  return {
    left: rect.left,
    width: rect.width,
    top: rect.bottom + 2,
    maxHeight: Math.min(LIST_MAX_HEIGHT, below)
  }
}

// A dropdown you can type into: clicking it opens the list, and what you type appears in the box and
// narrows the list to the options that contain it (Dec → Decision). Arrow keys and Enter choose,
// Escape closes. It stands in for a native <select> wherever a list is long enough to search, and
// is drawn in a layer of its own so a panel's scrolling never clips it.
export function ComboSelect<T extends string>({
  value,
  mixed,
  options,
  onChange,
  ariaLabel,
  className
}: {
  value: T | undefined
  mixed: boolean
  options: ComboOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}): React.JSX.Element {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [typed, setTyped] = useState(false)
  const [active, setActive] = useState(0)
  const [placement, setPlacement] = useState<Placement | null>(null)

  const current = options.find((o) => o.value === value)
  const label = mixed ? 'Mixed' : (current?.label ?? '')

  // The list in the order it is shown: ungrouped options, then each group in the order it first appears.
  const ordered = useMemo(() => {
    const groups = [...new Set(options.filter((o) => o.group).map((o) => o.group as string))]
    return [
      ...options.filter((o) => !o.group),
      ...groups.flatMap((g) => options.filter((o) => o.group === g))
    ]
  }, [options])

  const words = typed ? query.trim().toLowerCase().split(/\s+/).filter(Boolean) : []
  const shown = ordered.filter((o) => {
    const text = `${o.label} ${o.terms ?? ''}`.toLowerCase()
    return words.every((w) => text.includes(w))
  })

  useLayoutEffect(() => {
    if (!open || !inputRef.current) return
    const place = (): void => {
      if (inputRef.current) setPlacement(placementOf(inputRef.current))
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  const openList = (): void => {
    if (open) return
    setQuery(label)
    setTyped(false)
    setActive(
      Math.max(
        0,
        ordered.findIndex((o) => o.value === value)
      )
    )
    setOpen(true)
    // What is in the box is replaced by the first key typed.
    requestAnimationFrame(() => inputRef.current?.select())
  }

  const close = (): void => {
    setOpen(false)
    setTyped(false)
  }

  const choose = (option: ComboOption<T>): void => {
    close()
    if (mixed || option.value !== value) onChange(option.value)
  }

  // Keeps the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, listId])

  const list =
    open && placement
      ? createPortal(
          <div
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="combo-select-list"
            style={{
              left: placement.left,
              width: placement.width,
              top: placement.top,
              bottom: placement.bottom,
              maxHeight: placement.maxHeight
            }}
            // Keeps the box focused while an option is clicked, so the blur does not close the list first.
            onMouseDown={(e) => e.preventDefault()}
          >
            {shown.length === 0 && <div className="combo-select-none">Nothing matches</div>}
            {shown.map((option, i) => {
              const startsGroup = option.group !== undefined && option.group !== shown[i - 1]?.group
              return (
                <div key={option.value || '__empty'}>
                  {startsGroup && <div className="combo-select-group">{option.group}</div>}
                  <div
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={!mixed && option.value === value}
                    className={`combo-select-option${i === active ? ' active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(option)}
                  >
                    {option.label}
                  </div>
                </div>
              )
            })}
          </div>,
          document.body
        )
      : null

  return (
    <div className={`combo-select${className ? ` ${className}` : ''}`}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown.length > 0 ? `${listId}-${active}` : undefined}
        className="property-select-field combo-select-input"
        autoComplete="off"
        spellCheck={false}
        value={open ? query : label}
        placeholder={mixed ? 'Mixed' : 'Select…'}
        onFocus={openList}
        onClick={openList}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value)
          setTyped(true)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) {
              openList()
              return
            }
            const step = e.key === 'ArrowDown' ? 1 : -1
            setActive((a) => Math.max(0, Math.min(shown.length - 1, a + step)))
          } else if (e.key === 'Enter') {
            if (open && shown[active]) {
              e.preventDefault()
              choose(shown[active])
            }
          } else if (e.key === 'Escape') {
            if (open) {
              e.preventDefault()
              e.stopPropagation()
              close()
            }
          }
        }}
      />
      <span className="combo-select-caret" aria-hidden="true">
        ▾
      </span>
      {list}
    </div>
  )
}
