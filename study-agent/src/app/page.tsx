import Planner from '@/components/Planner'
import TaskList from '@/components/TaskList'

export default function HomePage() {
  return (
    <div className="container py-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Planner</h1>
        <div className="text-sm text-white/60">All-in-one internal calendar and tasks</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 card p-4">
          <Planner />
        </section>
        <section className="card p-4">
          <TaskList />
        </section>
      </div>
    </div>
  )
}
