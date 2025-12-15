import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import './App.css'
import { db } from './firebase'

const COLUMNS = [
  { id: 'todo', label: 'To Do', tone: 'royal' },
  { id: 'doing', label: 'In Progress', tone: 'sunset' },
  { id: 'done', label: 'Done', tone: 'mint' },
]

function App() {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [draggingId, setDraggingId] = useState(null)
  const [activeColumn, setActiveColumn] = useState(null)
  const [theme, setTheme] = useState('dark')
  const userId = import.meta.env.VITE_USER_ID || 'User 1'
  const userCollection = 'to-do-list'
  const tasksRef = useMemo(
    () => collection(db, userCollection, userId, 'tasks'),
    [userCollection, userId],
  )

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

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!title.trim()) return

    try {
    await addDoc(tasksRef, {
      title: title.trim(),
      note: note.trim(),
      status: 'todo',
      userId,
      createdAt: serverTimestamp(),
    })
    resetForm()
    } catch (error) {
      console.error('Error adding task', error)
      alert('Could not add task. Check console for details.')
    }
  }

  const handleDrop = (event, status) => {
    event.preventDefault()
    const taskId = event.dataTransfer.getData('text/plain')
    if (!taskId) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === status) {
      setDraggingId(null)
      setActiveColumn(null)
      return
    }

    updateDoc(doc(db, 'users', userId, 'tasks', taskId), {
      status,
    }).catch((error) => console.error('Error updating task status', error))
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

  useEffect(() => {
    // Ensure the parent user document exists so the `tasks` subcollection
    // is visible in the Firestore console (otherwise it can look empty).
    setDoc(
      doc(db, userCollection, userId),
      { userId, updatedAt: serverTimestamp() },
      { merge: true },
    ).catch((error) => {
      console.error('Error creating user record', error)
    })
  }, [userCollection, userId])

  useEffect(() => {
    const q = query(tasksRef, orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const nextTasks = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          title: data.title || '',
          note: data.note || '',
          status: data.status || 'todo',
          createdAt: data.createdAt,
        }
      })
      setTasks(nextTasks)
    })

    return unsubscribe
  }, [tasksRef])

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
