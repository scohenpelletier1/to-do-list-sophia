import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import './App.css'
import { auth, db } from './firebase'

const COLUMNS = [
  { id: 'todo', label: 'To Do', tone: 'royal' },
  { id: 'doing', label: 'In Progress', tone: 'sunset' },
  { id: 'done', label: 'Done', tone: 'mint' },
]

function App({ user }) {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [draggingId, setDraggingId] = useState(null)
  const [activeColumn, setActiveColumn] = useState(null)
  const [theme, setTheme] = useState(() => {
    // Check localStorage for saved preference, default to 'light'
    return localStorage.getItem('theme') || 'light'
  })
  const userId = user?.uid || 'anonymous'
  const userCollection = 'to-do-list'

  const handleSignOut = async () => {
    await signOut(auth)
  }
  const tasksRef = useMemo(
    () => collection(db, userCollection, userId, 'tasks'),
    [userCollection, userId],
  )

  const tasksByColumn = useMemo(() => {
    const groups = tasks.reduce((acc, task) => {
      acc[task.status] = acc[task.status] || []
      acc[task.status].push(task)
      return acc
    }, {})
    // Sort each column by order
    Object.keys(groups).forEach((status) => {
      groups[status].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    })
    return groups
  }, [tasks])

  const resetForm = () => {
    setTitle('')
    setNote('')
  }

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!title.trim()) return

    // Get current max order in 'todo' column to add new task at the end
    const todoTasks = tasksByColumn['todo'] || []
    const maxOrder = todoTasks.length > 0 
      ? Math.max(...todoTasks.map(t => t.order ?? 0)) + 1 
      : 0

    try {
      await addDoc(tasksRef, {
        title: title.trim(),
        note: note.trim(),
        status: 'todo',
        order: maxOrder,
        userId,
        createdAt: serverTimestamp(),
      })
      resetForm()
    } catch (error) {
      console.error('Error adding task', error)
      alert('Could not add task. Check console for details.')
    }
  }

  const handleDelete = async (taskId) => {
    try {
      await deleteDoc(doc(tasksRef, taskId))
    } catch (error) {
      console.error('Error deleting task', error)
      alert('Could not delete task. Check console for details.')
    }
  }

  const handleDrop = async (event, status, dropIndex = null) => {
    event.preventDefault()
    const taskId = event.dataTransfer.getData('text/plain')
    if (!taskId) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task) {
      setDraggingId(null)
      setActiveColumn(null)
      return
    }

    const columnTasks = tasksByColumn[status] || []
    
    try {
      if (task.status === status && dropIndex !== null) {
        // Reordering within the same column
        const currentIndex = columnTasks.findIndex(t => t.id === taskId)
        if (currentIndex === dropIndex) {
          setDraggingId(null)
          setActiveColumn(null)
          return
        }

        // Create new order for all tasks in the column
        const reorderedTasks = [...columnTasks]
        const [movedTask] = reorderedTasks.splice(currentIndex, 1)
        reorderedTasks.splice(dropIndex, 0, movedTask)

        // Batch update all orders
        const batch = writeBatch(db)
        reorderedTasks.forEach((t, index) => {
          batch.update(doc(tasksRef, t.id), { order: index })
        })
        await batch.commit()
      } else if (task.status !== status) {
        // Moving to a different column
        const newOrder = columnTasks.length > 0
          ? Math.max(...columnTasks.map(t => t.order ?? 0)) + 1
          : 0

        await updateDoc(doc(tasksRef, taskId), {
          status,
          order: newOrder,
        })
      }
    } catch (error) {
      console.error('Error updating task', error)
    }

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
    // Save preference to localStorage
    localStorage.setItem('theme', theme)
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
    const q = query(tasksRef, orderBy('order', 'asc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const nextTasks = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          title: data.title || '',
          note: data.note || '',
          status: data.status || 'todo',
          order: data.order ?? 0,
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
          <div className="user-bar">
            <span className="user-greeting">
              Welcome, {user?.displayName || user?.email || 'User'}
            </span>
            <button
              type="button"
              className="sign-out-btn"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
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
                {columnTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={`card ${
                      draggingId === task.id ? 'is-dragging' : ''
                    }`}
                    draggable
                    onDragStart={(event) => handleDragStart(event, task.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.stopPropagation()
                      handleDrop(event, column.id, index)
                    }}
                  >
                    <div className="card__header">
                      <div className="chip">Task</div>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => handleDelete(task.id)}
                        aria-label="Delete task"
                      >
                        ×
                      </button>
                    </div>
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
