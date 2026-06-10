import { useStore } from './store'
import Title from './ui/Title'
import TeamSelect from './ui/TeamSelect'
import MainShell from './ui/MainShell'
import WatchGame from './ui/WatchGame'
import SeasonEnd from './ui/SeasonEnd'
import FAScreen from './ui/FAScreen'
import DraftScreen from './ui/DraftScreen'
import GameOver from './ui/GameOver'

export default function App() {
  const screen = useStore(s => s.screen)
  const tick = useStore(s => s.tick)
  const league = useStore(s => s.league)
  const watch = useStore(s => s.watch)
  void tick

  let body: JSX.Element
  if (screen === 'select') body = <TeamSelect />
  else if (screen === 'title' || !league) body = <Title />
  else if (league.phase === 'eval') body = <SeasonEnd />
  else if (league.phase === 'fa') body = <FAScreen />
  else if (league.phase === 'draft') body = <DraftScreen />
  else if (league.phase === 'gameover') body = <GameOver />
  else body = <MainShell />

  return (
    <div className="app">
      {body}
      {watch && <WatchGame />}
    </div>
  )
}
