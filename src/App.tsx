import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { MilkdownProvider } from "@milkdown/react";

import { GiHamburgerMenu } from "react-icons/gi";
import { MdNoteAdd } from "react-icons/md";
import { MdDeleteForever } from "react-icons/md";

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

import debounce from 'debounce';

import Editor, { EditorRef } from "./components/Editor";
import "./App.css";

export interface NoteMetaData {
  readonly id: string;
  title: string;
  lastModified: number;
}

export interface YNote {
  readonly noteId: string;
  readonly doc: Y.Doc;
  readonly persistence: IndexeddbPersistence;
}

interface NoteService {
  save(note: NoteMetaData): Promise<void>;
  list(): Promise<NoteMetaData[]>;
  get(id: string): Promise<NoteMetaData | null>;
  delete(id: string): Promise<void>;
}

class YjsNoteService implements NoteService {
  readonly rootDoc: Y.Doc;
  private readonly notes: Y.Map<Y.Map<string | number | undefined>>;
  private readonly persistence: IndexeddbPersistence;

  constructor() {
    this.rootDoc = new Y.Doc();
    this.notes = this.rootDoc.getMap();
    this.persistence = new IndexeddbPersistence("notes-list", this.rootDoc);
  }

  async delete(id: string) {
    await this.persistence.whenSynced;

    this.notes.delete(id);
  }

  async get(id: string) {
    await this.persistence.whenSynced;

    const note = this.notes.get(id);
    if (!note) return null;

    return {
      id: note.get("id") as string,
      title: note.get("title") as string,
      lastModified: note.get("lastModified") as number,
    } as NoteMetaData;
  }

  async save(note: NoteMetaData) {
    await this.persistence.whenSynced;

    const found = this.notes.get(note.id);
    if (found) {
      found.set("title", note.title);
      found.set("lastModified", note.lastModified);
    } else {
      const noteMap = new Y.Map<string | number | undefined>();

      noteMap.set("id", note.id);
      noteMap.set("title", note.title);
      noteMap.set("lastModified", note.lastModified);

      this.notes.set(note.id, noteMap);
    }
  }

  async list() {
    await this.persistence.whenSynced;

    return Array.from(this.notes.keys()).map(id => {
      const note = this.notes.get(id)!;
      return {
        id: note.get("id") as string,
        title: note.get("title") as string,
        lastModified: note.get("lastModified") as number,
      }
    }).sort((a, b) => b.lastModified - a.lastModified);
  }
}

const noteMetaDataService = new YjsNoteService();

function createNote() {
  const newNote: NoteMetaData = {
    id: nanoid(32),
    title: 'Untitled Note',
    lastModified: Date.now()
  };
  return newNote;
}

let firstCreationLock = true; // Lock for run conditions on startup: Running React in strict mode could call useEffects more than once

function App() {
  const editorRef = React.useRef<EditorRef>(null);
  const drawerRef = React.useRef<HTMLInputElement>(null); // Add reference to the drawer checkbox
  const deleteModalRef = React.useRef<HTMLDialogElement>(null);
  const [notes, setNotes] = useState<NoteMetaData[]>([]);
  const [currentNote, setCurrentNote] = useState<YNote | null>(null);
  const [shouldFocus, setShouldFocus] = useState(false);

  async function createNoteAndSave() {
    const newNote = createNote();
    await noteMetaDataService.save(newNote);
    return newNote;
  }

  async function setCurrent(noteId: string) {
    await currentNote?.persistence.destroy();
    currentNote?.doc.destroy();

    const noteMetaData = await noteMetaDataService.get(noteId);
    if (!noteMetaData) {
      throw Error(`Note with ID '${noteId}' does not exist`);
    }

    const doc = new Y.Doc({});
    const persistence = new IndexeddbPersistence(`note|${noteId}`, doc);
    await persistence.whenSynced;

    setCurrentNote({
      noteId,
      doc,
      persistence,
    });
  }

  useEffect(() => {
    const fetchNotes = async () => {
      const notesInStorage = await noteMetaDataService.list();
      if (notesInStorage.length > 0) {
        setNotes(notesInStorage);
        setCurrent(notesInStorage[0].id);
      } else {
        if (firstCreationLock) {
          firstCreationLock = false;
          const newNote = await createNoteAndSave();
          setNotes([newNote]);
          setCurrent(newNote.id);
        }
      }
    };
    fetchNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateNote = async () => {
    const newNote = createNote();
    setCurrent(newNote.id);
    noteMetaDataService.save(newNote);
    setShouldFocus(true);
    setNotes([newNote, ...notes]);
    return newNote;
  };

  const handleNoteClick = async (id: string) => {
    const note = await noteMetaDataService.get(id);
    if (note) {
      setCurrent(note.id);
      if (drawerRef.current) {
        drawerRef.current.checked = false; // Uncheck the drawer checkbox to close the drawer
      }
    }
  };

  const handleDeleteNote = async () => {
    if (currentNote) {
      await currentNote.persistence.clearData();
      await noteMetaDataService.delete(currentNote.noteId);
      const updatedNotes = notes.filter(note => note.id !== currentNote.noteId);
      if (updatedNotes.length > 0) {
        setNotes(updatedNotes);
        const nextNote = await noteMetaDataService.get(updatedNotes[0].id);
        if (nextNote) {
          setCurrent(nextNote.id);
        }
      } else {
        const newNote = await createNoteAndSave();
        setNotes([newNote]);
        setCurrent(newNote.id);
      }
    }
  };

  function onMarkdownUpdated() {
    return debounce(async () => {
      if (currentNote) {
        const markdown = editorRef.current?.getMarkdown() ?? '';
        const maxTitleLength = 50;
        let title = markdown.split('\n')[0].substring(0, maxTitleLength * 2).replace(/^#+/, '').replaceAll('&#x20;', '').trim() || 'Untitled Note';
        if (title.length > maxTitleLength) {
          title = title.substring(0, maxTitleLength).trim() + '...';
        }
        const updatedNote: NoteMetaData = {
          id: currentNote.noteId,
          title,
          lastModified: Date.now()
        };
        // setCurrent(updatedNote);
        await noteMetaDataService.save(updatedNote);
        setNotes([updatedNote, ...notes.filter(note => note.id !== updatedNote.id)]);
      }
    }, 200);
  };

  function onMounted() {
    setTimeout(() => {
      editorRef.current?.connect();
      if (shouldFocus) {
        editorRef.current?.focus();
        setShouldFocus(false);
      }
    }, 1); // XXX: Should probaly figure out why there is a timing issue and why I need this Timeout
  }

  return (
    <>
      {/* Delete Confirmation Modal */}
      <dialog className="modal" ref={deleteModalRef}>
        <div className="modal-box">
          <p className="py-4">
            Are you sure you want to delete the current note?
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
                <a className={`block text-ellipsis w-70 overflow-hidden whitespace-nowrap ${currentNote?.noteId === note.id ? 'menu-active' : ''}`} onClick={() => handleNoteClick(note.id)}>
                  {note.title}
                  <span className='block text-xs font-semibold opacity-60'>{new Date(note.lastModified).toLocaleString()}</span>
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
