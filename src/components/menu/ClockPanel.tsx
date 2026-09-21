import { Panel } from './Panel'
import { Segmented, Toggle } from '../ui/controls'
import { useSettings } from '@/store/settings'
import { usePictureInPicture } from '@/lib/pip'
import type { ClockMode, ScreenProtect } from '@/lib/types'

const PROTECT_ORDER: ScreenProtect[] = ['off', 'low', 'high', 'dvd']
const PROTECT_LABEL: Record<ScreenProtect, string> = {
  off: 'Off',
  low: 'Low',
  high: 'High',
  dvd: 'DVD',
}

export function ClockPanel() {
  const s = useSettings()
  const pip = usePictureInPicture()

  return (
    <Panel title="Clock">
      <Segmented<ClockMode>
        value={s.mode}
        onChange={s.setMode}
        options={[
          { value: 'clock', label: 'Clock' },
          { value: 'pomodoro', label: 'Pomo' },
          { value: 'stopwatch', label: 'Stopwatch' },
        ]}
      />

      <div className="grid grid-cols-2 gap-2">
        <Toggle
          label="Seconds"
          active={s.showSeconds}
          disabled={s.mode !== 'clock'}
          onClick={() => s.toggle('showSeconds')}
        />
        <Toggle
          label="Continuous"
          active={s.continuous}
          onClick={() => s.toggle('continuous')}
        />
        <Toggle label="24 Hour" active={s.hour24} onClick={() => s.toggle('hour24')} />
        <Toggle label="Hide Clock" active={s.hideClock} onClick={() => s.toggle('hideClock')} />
      </div>

      <Toggle
        label={`Screen Protect: ${PROTECT_LABEL[s.screenProtect]}`}
        active={s.screenProtect !== 'off'}
        onClick={() =>
          s.setScreenProtect(
            PROTECT_ORDER[(PROTECT_ORDER.indexOf(s.screenProtect) + 1) % PROTECT_ORDER.length],
          )
        }
      />

      {pip.supported && (
        <Toggle
          label={pip.active ? 'Exit Picture-in-Picture (I)' : 'Enable Picture-in-Picture (I)'}
          active={pip.active}
          onClick={pip.toggle}
        />
      )}
    </Panel>
  )
}
