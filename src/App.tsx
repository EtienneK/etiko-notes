import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { MilkdownProvider } from "@milkdown/react";

import { GiHamburgerMenu } from "react-icons/gi";
import { MdNoteAdd } from "react-icons/md";
import { MdDeleteForever } from "react-icons/md";

import Editor, { EditorRef } from "./components/Editor";
import "./App.css";

interface NoteWithoutText {
  readonly id: string;
  title: string;
  lastModified: Date;
}

export interface Note extends NoteWithoutText {
  text: string;
}

interface NoteService {
  save(note: Note): Promise<void>;
  list(): Promise<NoteWithoutText[]>;
  get(id: string): Promise<Note | null>;
  search(text: string): Promise<Note[]>;
  delete(id: string): Promise<void>;
}

interface NoteLocalStorage {
  readonly id: string;
  title: string;
  text: string;
  lastModified: string;
}

class LocalStorageNoteService implements NoteService {
  async delete(id: string) {
    localStorage.removeItem(this._key(id));
  }

  async search(text: string) {
    return Object.keys(localStorage).map(id => {
      const note = JSON.parse(localStorage.getItem(id)!) as NoteLocalStorage;
      return {
        id: note.id,
        title: note.title,
        text: note.text,
        lastModified: new Date(note.lastModified)
      };
    }).filter(note => {
      return note.text.toLowerCase().includes(text.toLowerCase()) || note.title.toLowerCase().includes(text.toLowerCase());
    });
  }

  async get(id: string) {
    const note = localStorage.getItem(this._key(id));
    return note ? JSON.parse(note) : null;
  }

  async save(note: Note) {
    const maxTitleLength = 50;
    let title = note.text.split('\n')[0].replace(/^#+/, '').trim() || 'Untitled Note';
    if (title.length > maxTitleLength) {
      title = title.substring(0, maxTitleLength).trim() + '...';
    }
    note.title = title;
    localStorage.setItem(this._key(note.id), JSON.stringify(note));
  }

  async list() {
    return Object.keys(localStorage).map(id => {
      const note = JSON.parse(localStorage.getItem(id)!) as NoteLocalStorage;
      return {
        id: note.id,
        title: note.title,
        lastModified: new Date(note.lastModified)
      }
    }).sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  _key: (id: string) => string = (id) => `notes|${id}`;
}

const noteService = new LocalStorageNoteService();

function createNote() {
  const newNote = {
    id: nanoid(),
    title: 'Untitled Note',
    text: '',
    lastModified: new Date()
  };
  return newNote;
}


let firstCreationLock = true; // Lock for run conditions on startup: Running React in strict mode could call useEffects more than once

function App() {
  const editorRef = React.useRef<EditorRef>(null);
  const drawerRef = React.useRef<HTMLInputElement>(null); // Add reference to the drawer checkbox
  const deleteModalRef = React.useRef<HTMLDialogElement>(null);
  const [notes, setNotes] = useState<NoteWithoutText[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [shouldFocus, setShouldFocus] = useState(false);

  async function createNoteAndSave() {
    const newNote = createNote();
    await noteService.save(newNote);
    return newNote;
  }

  useEffect(() => {
    const fetchNotes = async () => {
      const notesInStorage = await noteService.list();
      if (notesInStorage.length > 0) {
        setNotes(notesInStorage);
        setCurrentNote(await noteService.get(notesInStorage[0].id));
      } else {
        if (firstCreationLock) {
          firstCreationLock = false;
          const newNote = await createNoteAndSave();
          setNotes([newNote]);
          setCurrentNote(newNote);
        }
      }
    };
    fetchNotes();
  }, []);

  const handleCreateNote = async () => {
    const newNote = createNote();
    setCurrentNote(newNote);
    noteService.save(newNote);
    setShouldFocus(true);
    setNotes([newNote, ...notes]);
    return newNote;
  };

  const handleNoteClick = async (id: string) => {
    const note = await noteService.get(id);
    if (note) {
      setCurrentNote(note);
      if (drawerRef.current) {
        drawerRef.current.checked = false; // Uncheck the drawer checkbox to close the drawer
      }
    }
  };

  const handleDeleteNote = async () => {
    if (currentNote) {
      await noteService.delete(currentNote.id);
      const updatedNotes = notes.filter(note => note.id !== currentNote.id);
      if (updatedNotes.length > 0) {
        setNotes(updatedNotes);
        const nextNote = await noteService.get(updatedNotes[0].id);
        if (nextNote) {
          setCurrentNote(nextNote);
        }
      } else {
        const newNote = await createNoteAndSave();
        setNotes([newNote]);
        setCurrentNote(newNote);
      }
    }
  };

  function onMarkdownUpdated() {
    return async () => {
      const markdown = editorRef.current?.getMarkdown();
      if (currentNote && markdown) {
        const updatedNote = { ...currentNote, text: markdown, lastModified: new Date() };
        setCurrentNote(updatedNote);
        await noteService.save(updatedNote);
        if (currentNote.id !== notes[0].id) {
          setNotes([updatedNote, ...notes.filter(note => note.id !== updatedNote.id)]);
        } else {
          notes[0] = updatedNote;
          setNotes(notes);
        }
      }
    }
  };

  function onMounted() {
    if (shouldFocus) {
      editorRef.current?.focus();
      setShouldFocus(false);
    }
  }

  return (
    <>
      {/* Delete Confirmation Modal */}
      <dialog className="modal" ref={deleteModalRef}>
        <div className="modal-box">
          <p className="py-4">
            Are you sure you want to delete '{currentNote?.title}'?
          </p>
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn btn-neutral mr-2">Cancel</button>
              <button className="btn btn-primary" onClick={handleDeleteNote}>Delete</button>
            </form>
          </div>
        </div>
      </dialog>

      <div className="drawer h-full">
        <input id="main-drawer" type="checkbox" className="drawer-toggle" ref={drawerRef} />
        <div className="drawer-content h-full min-h-full">
          {/* Page content here */}

          <div className="fixed start-0 top-0 z-1">
            <label
              htmlFor="main-drawer"
              className="btn btn-ghost drawer-button m-2 opacity-75 p-1 text-3xl text-primary"
            >
              <GiHamburgerMenu />
            </label>

            <button className="btn btn-ghost text-3xl p-1 m-2 opacity-75 text-primary"
              onClick={() => deleteModalRef.current?.showModal()}
              disabled={!currentNote}
            >
              <MdDeleteForever />
            </button>
          </div>

          <button
            className="btn btn-ghost text-3xl p-1 fixed top-0 end-0 m-2 z-1 opacity-75 text-primary"
            onClick={handleCreateNote}
            disabled={!currentNote}
          >
            <MdNoteAdd />
          </button>

          <MilkdownProvider>
            <Editor
              onMarkdownUpdated={onMarkdownUpdated()}
              onMounted={onMounted}
              ref={editorRef}
              currentNote={currentNote}
              readonly={!currentNote}
            />
          </MilkdownProvider>

        </div>
        <div className="drawer-side z-2">
          <label
            htmlFor="main-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
          >
          </label>
          <ul className="menu bg-base-200 text-base-content min-h-full w-80 p-4 text-ellipsis">
            {/* Sidebar content here */}
            {notes.map(note => (
              <li key={note.id}>
                <a className={`block text-ellipsis w-70 overflow-hidden whitespace-nowrap ${currentNote?.id === note.id ? 'menu-active' : ''}`} onClick={() => handleNoteClick(note.id)}>
                  {note.title}
                  <span className='block text-xs font-semibold opacity-60'>{note.lastModified.toLocaleString()}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export default App;
