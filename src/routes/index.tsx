import { createFileRoute } from '@tanstack/react-router'
import { MultiplayerBoard } from '../components/Game/Board/MultiplayerBoard'

export const Route = createFileRoute('/')({
  component: MultiplayerBoard,
})
