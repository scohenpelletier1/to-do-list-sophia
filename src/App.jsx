import { useEffect, useMemo, useState } from 'react'
import './App.css'

const COLUMNS = [
  { id: 'todo', label: 'To Do', tone: 'royal' },
  { id: 'doing', label: 'In Progress', tone: 'sunset' },
  { id: 'done', label: 'Done', tone: 'mint' },
]

function App() {
  const [tasks, setTasks] = useState([
    {
      id: 't-1',
      title: 'Brainstorm project ideas',
      note: 'Pick one small win to ship this week.',
      status: 'todo',
    },
    {
      id: 't-2',
      title: 'Wireframe the UI',
      note: 'Sketch the core flow and states.',
      status: 'doing',
    },
    {
      id: 't-3',
      title: 'Review scope with team',
      note: 'Confirm priorities and deadlines.',
      status: 'done',
    },
  ])
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [draggingId, setDraggingId] = useState(null)
  const [activeColumn, setActiveColumn] = useState(null)
  const [theme, setTheme] = useState('dark')

  const tasksByColumn = useMemo(() => {
    return tasks.reduce((groups, task) => {
      groups[task.status] = groups[task.status] || []
      groups[task.status].push(task)
      return groups
    }, {})
  }, [tasks])

  const resetForm = () => {
    setTitle('')
    setNote('')
  }

  const handleAdd = (event) => {
    event.preventDefault()
    if (!title.trim()) return

    const id = `t-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`
    setTasks((prev) => [
      {
        id,
        title: title.trim(),
        note: note.trim(),
        status: 'todo',
      },
      ...prev,
    ])
    resetForm()
  }

  const handleDrop = (event, status) => {
    event.preventDefault()
    const taskId = event.dataTransfer.getData('text/plain')
    if (!taskId) return

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
            }
          : task,
      ),
    )
    setDraggingId(null)
    setActiveColumn(null)
  }

  const handleDragStart = (event, taskId) => {
    event.dataTransfer.setData('text/plain', taskId)
    event.dataTransfer.effectAllowed = 'move'
    setDraggingId(taskId)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setActiveColumn(null)
  }

  const handleDragEnter = (status) => setActiveColumn(status)

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
  }, [theme])

  return (
    <main className="app">
      <header className="hero">
        <div className="hero__top">
          <p className="eyebrow">Plan. Drag. Done.</p>
          <h1>Task bins with simple drag & drop</h1>
          <p className="lede">
            Create tasks, then drag them between bins to track progress.
            Everything happens in your browser—no setup needed.
          </p>
          <div className="theme-toggle__wrapper">
            <button
              type="button"
              className="theme-toggle"
              onClick={() =>
                setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
              }
              aria-label="Toggle light or dark mode"
            >
              {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
          </div>
        </div>

        <form className="new-task" onSubmit={handleAdd}>
          <div className="field">
            <label htmlFor="task-title">Task title</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Write project brief"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="task-note">Details (optional)</label>
            <textarea
              id="task-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a quick note or next step"
              rows={2}
            />
          </div>
          <button type="submit">Add task</button>
        </form>
      </header>

      <section className="board">
        {COLUMNS.map((column) => {
          const columnTasks = tasksByColumn[column.id] || []
          const isActive = activeColumn === column.id

          return (
            <article key={column.id} className={`column ${column.tone}`}>
              <header className="column__header">
                <div className="column__titles">
                  <h2>{column.label}</h2>
                  <span className="count">{columnTasks.length}</span>
                </div>
                <p className="hint">
                  Drag tasks here to mark them as {column.label.toLowerCase()}.
                </p>
              </header>

              <div
                className={`dropzone ${isActive ? 'is-active' : ''}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, column.id)}
                onDragEnter={() => handleDragEnter(column.id)}
                onDragLeave={() => setActiveColumn(null)}
              >
                {columnTasks.length === 0 && (
                  <p className="empty">Drop a task here</p>
                )}
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`card ${
                      draggingId === task.id ? 'is-dragging' : ''
                    }`}
                    draggable
                    onDragStart={(event) => handleDragStart(event, task.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="chip">Task</div>
                    <h3>{task.title}</h3>
                    {task.note ? <p className="note">{task.note}</p> : null}
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}

export default App
