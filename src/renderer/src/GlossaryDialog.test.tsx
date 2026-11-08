import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GlossaryDialog from './GlossaryDialog'

afterEach(cleanup)

describe('the glossary window', () => {
  it('lists the terms of the glossary file with their plain text', () => {
    render(<GlossaryDialog onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Diagram metamodel' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Edge direction set' })).toBeTruthy()
    expect(screen.queryByText(/For developers/)).toBeNull()
  })

  it('filters by name and by text', () => {
    render(<GlossaryDialog onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Filter the glossary'), { target: { value: 'gdpr' } })
    expect(screen.getByRole('heading', { name: 'Diagram metamodel' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Legend' })).toBeNull()
  })

  it('says so when nothing matches', () => {
    render(<GlossaryDialog onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Filter the glossary'), { target: { value: 'zzzzzz' } })
    expect(screen.getByText('Nothing matches.')).toBeTruthy()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<GlossaryDialog onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
