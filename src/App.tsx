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

function App() {
  const editorRef = React.useRef<EditorRef>(null);
  const drawerRef = React.useRef<HTMLInputElement>(null); // Add reference to the drawer checkbox
  const [notes, setNotes] = useState<NoteWithoutText[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [shouldFocus, setShouldFocus] = useState(false);

  useEffect(() => {
    const fetchNotes = async () => {
      const notes = await noteService.list();
      setNotes(notes);
      setCurrentNote(notes[0] ? await noteService.get(notes[0].id) : await handleCreateNote());
    };
    fetchNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateNote = async () => {
    const newNote = createNote();
    setNotes([...notes, newNote]);
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
      setNotes(updatedNotes);
      if (updatedNotes.length > 0) {
        const nextNote = await noteService.get(updatedNotes[0].id);
        if (nextNote) {
          setCurrentNote(nextNote);
        }
      } else {
        const newNote = await handleCreateNote();
        setNotes([newNote]);
      }
    }
  };

  function onMarkdownUpdated() {
    return () => {
      const markdown = editorRef.current?.getMarkdown();
      if (currentNote && markdown) {
        const updatedNote = { ...currentNote, text: markdown, lastModified: new Date() };
        setCurrentNote(updatedNote);
        noteService.save(updatedNote);
        setNotes([updatedNote, ...notes.filter(note => note.id !== updatedNote.id)]);
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

            <button className="btn btn-ghost text-3xl p-1 m-2 opacity-75 text-primary" onClick={handleDeleteNote}>
              <MdDeleteForever />
            </button>
          </div>

          <button
            className="btn btn-ghost text-3xl p-1 fixed top-0 end-0 m-2 z-1 opacity-75 text-primary"
            onClick={handleCreateNote}
          >
            <MdNoteAdd />
          </button>

          <MilkdownProvider>
            <Editor onMarkdownUpdated={onMarkdownUpdated()} onMounted={onMounted} ref={editorRef} currentNote={currentNote} />
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
              <li key={note.id} className={currentNote?.id === note.id ? 'bg-primary text-primary-content' : ''}>
                <a className='block text-ellipsis w-70 overflow-hidden whitespace-nowrap' onClick={() => handleNoteClick(note.id)}>
                  {note.title}
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
