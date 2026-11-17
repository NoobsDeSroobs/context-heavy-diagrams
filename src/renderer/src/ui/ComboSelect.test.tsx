import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComboSelect } from './ComboSelect'

afterEach(cleanup)

const options = [
  { value: 'none', label: 'None' },
  { value: 'step', label: 'Step', group: 'Steps' },
  { value: 'decision', label: 'Decision', group: 'Gateways', terms: 'xor choice' },
  { value: 'parallel', label: 'Parallel split or join', group: 'Gateways' }
]

const setup = (
  props: Partial<{ value: string; mixed: boolean }> = {}
): { onChange: ReturnType<typeof vi.fn>; box: HTMLInputElement } => {
  const onChange = vi.fn()
  render(
    <ComboSelect
      ariaLabel="Kind"
      value={props.value ?? 'step'}
      mixed={props.mixed ?? false}
      options={options}
      onChange={onChange}
    />
  )
  return { onChange, box: screen.getByRole('combobox', { name: 'Kind' }) as HTMLInputElement }
}

const shown = (): string[] => screen.getAllByRole('option').map((o) => o.textContent ?? '')

describe('ComboSelect', () => {
  it('shows the chosen option in the box, and the whole list when it opens', () => {
    const { box } = setup()
    expect(box.value).toBe('Step')
    fireEvent.focus(box)
    expect(shown()).toEqual(['None', 'Step', 'Decision', 'Parallel split or join'])
  })

  it('narrows the list to what is typed, and the typed text is in the box', () => {
    const { box } = setup()
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'Dec' } })
    expect(box.value).toBe('Dec')
    expect(shown()).toEqual(['Decision'])
  })

  it('also finds an option by the extra terms it carries', () => {
    const { box } = setup()
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'xor' } })
    expect(shown()).toEqual(['Decision'])
  })

  it('chooses the first match on Enter, and the box then shows it', () => {
    const { box, onChange } = setup()
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'par' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('parallel')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('moves with the arrow keys', () => {
    const { box, onChange } = setup()
    fireEvent.focus(box)
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('decision')
  })

  it('closes on Escape without choosing, and does not call back for the value it has', () => {
    const { box, onChange } = setup()
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'Dec' } })
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(box)
    fireEvent.click(screen.getByRole('option', { name: 'Step' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('lists the groups under their headings, ungrouped options first', () => {
    const { box } = setup()
    fireEvent.focus(box)
    expect(screen.getByText('Steps')).toBeTruthy()
    expect(screen.getByText('Gateways')).toBeTruthy()
  })

  it('says Nothing matches when no option contains the text', () => {
    const { box } = setup()
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'zzz' } })
    expect(screen.getByText('Nothing matches')).toBeTruthy()
  })

  it('shows Mixed when the selection differs, and a click chooses even the value it had', () => {
    const { box, onChange } = setup({ mixed: true })
    expect(box.value).toBe('Mixed')
    fireEvent.focus(box)
    fireEvent.click(screen.getByRole('option', { name: 'Step' }))
    expect(onChange).toHaveBeenCalledWith('step')
  })
})
