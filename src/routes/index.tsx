import { createFileRoute } from "@tanstack/react-router"
import { KursApp } from "@/components/kurs-app"
import { getLive } from "@/lib/live"

export const Route = createFileRoute("/")({
  loader: () => getLive(),
  component: Home,
})

function Home() {
  const data = Route.useLoaderData()
  return <KursApp initial={data} />
}
