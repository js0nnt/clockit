import { useState } from 'react'

interface TileState {
  current: string
  previous: string
  /** bumped on every change so the leaf animations restart */
  key: number
}

/**
 * One flip tile. Four layers: a static top showing the incoming digit, a static
 * bottom still showing the outgoing one, and two leaves that fold across the seam.
 */
export function FlipTile({ value, single }: { value: string; single: boolean }) {
  const [state, setState] = useState<TileState>({ current: value, previous: value, key: 0 })

  // Adjusting state during render rather than in an effect: React discards this
  // render and redoes it immediately, so the leaves never paint the stale digit.
  if (state.current !== value) {
    setState({ current: value, previous: state.current, key: state.key + 1 })
  }

  const idle = state.key === 0

  return (
    <div className="tile" data-single={single}>
      <div className="half half-top">
        <span className="glyph">{state.current}</span>
      </div>
      <div className="half half-bottom">
        <span className="glyph">{state.previous}</span>
      </div>

      <div key={`t${state.key}`} className="leaf leaf-top" data-idle={idle}>
        <span className="glyph">{state.previous}</span>
      </div>
      <div key={`b${state.key}`} className="leaf leaf-bottom" data-idle={idle}>
        <span className="glyph">{state.current}</span>
      </div>
    </div>
  )
}
