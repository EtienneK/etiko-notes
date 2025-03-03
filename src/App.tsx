import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { MilkdownProvider } from "@milkdown/react";

import { GiHamburgerMenu } from "react-icons/gi";
import { MdNoteAdd } from "react-icons/md";
import { MdDeleteForever } from "react-icons/md";

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

import Editor, { EditorRef } from "./components/Editor";
import "./App.css";

interface NoteMetaData {
  readonly id: string;
  title: string;
  lastModified: number;
}

export interface Note extends NoteMetaData {
  text: string;
}

interface NoteService {
  save(note: Note): Promise<void>;
  list(): Promise<NoteMetaData[]>;
  get(id: string): Promise<Note | null>;
  search(text: string): Promise<Note[]>;
  delete(id: string): Promise<void>;
}

class LocalStorageNoteService implements NoteService {
  private readonly rootDoc: Y.Doc;
  private readonly notes: Y.Map<Y.Map<string | number | Y.Doc>>;
  private readonly persistence: IndexeddbPersistence;
  private readonly notesPersistence: { [key: string]: IndexeddbPersistence} = {};

  constructor() {
    this.rootDoc = new Y.Doc();
    this.notes = this.rootDoc.getMap();
    this.persistence = new IndexeddbPersistence("notes", this.rootDoc);
  }

  private async persist(doc: Y.Doc): Promise<Y.Doc> {
    if (!this.notesPersistence["note|" + doc.guid]) {
      const persist = new IndexeddbPersistence("note|" + doc.guid, doc)
      await persist.whenSynced;
      this.notesPersistence["note|" + doc.guid] = persist;
    }
    return doc;
  }

  async delete(id: string) {
    await this.persistence.whenSynced;
    const note = this.notes.get(id);
    if (note) {
      const doc = note.get("text") as Y.Doc;
      await this.notesPersistence["note|" + doc.guid].clearData();
      this.notes.delete(id);
    }
  }

  search(): Promise<Note[]> {
    throw new Error("unsupported");
  }

  async get(id: string) {
    await this.persistence.whenSynced;
    const note = this.notes.get(id);
    const doc = await this.persist(note!.get("text") as Y.Doc);
    const docText = doc.getText("text");
    const text = docText.toString();

    return note ? {
      id: note.get("id") as string,
      title: note.get("title") as string,
      lastModified: note.get("lastModified") as number,
      text,
    } as Note : null;
  }

  async save(note: Note) {
    await this.persistence.whenSynced;
    const maxTitleLength = 50;
    let title = note.text.split('\n')[0].replace(/^#+/, '').trim() || 'Untitled Note';
    if (title.length > maxTitleLength) {
      title = title.substring(0, maxTitleLength).trim() + '...';
    }
    note.title = title;

    const found = this.notes.get(note.id);
    if (found) {
      found.set("title", note.title);
      found.set("lastModified", note.lastModified);
      const textDoc = await this.persist(found.get("text") as Y.Doc);
      const textText = textDoc.getText("text");
      // TODO fix the below so that deltas get inserted
      textText.delete(0, textText.length);
      textText.insert(0, note.text);
    } else {
      const noteMap = new Y.Map<string | number | Y.Doc>();
      const textDoc = await this.persist(new Y.Doc());
      const textText = textDoc.getText("text");
      textText.insert(0, note.text);

      noteMap.set("id", note.id);
      noteMap.set("title", note.title);
      noteMap.set("lastModified", note.lastModified);
      noteMap.set("text", textDoc)
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

const noteService = new LocalStorageNoteService();

function createNote() {
  const newNote = {
    id: nanoid(),
    title: 'Untitled Note',
    text: '',
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
        const updatedNote = { ...currentNote, text: markdown, lastModified: Date.now() };
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
