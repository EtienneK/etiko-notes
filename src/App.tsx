import React, { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { MilkdownProvider } from "@milkdown/react";

import { IoClose } from "react-icons/io5";
import { GiHamburgerMenu } from "react-icons/gi";
import { MdNoteAdd } from "react-icons/md";
import { MdDeleteForever } from "react-icons/md";
import { FaGear } from "react-icons/fa6";

import debounce from "debounce";

import Editor, { EditorRef } from "./components/Editor";
import "./App.css";
import {
  NoteMetaData,
  NoteService,
  NotebookService,
  YNote,
} from "./services/notes";

const noteMetaDataService = new NotebookService();
const noteService = new NoteService();

const defaultTitle = "Untitled Note";
function newNoteMetaData(): NoteMetaData {
  const metaData: NoteMetaData = {
    id: nanoid(32),
    title: defaultTitle,
    lastModified: Date.now(),
  };
  return metaData;
}

let firstCreationLock = true; // Lock for run conditions on startup: Running React in strict mode could call useEffects more than once

function App() {
  const editorRef = React.useRef<EditorRef>(null);
  const drawerRef = React.useRef<HTMLInputElement>(null); // Add reference to the drawer checkbox
  const deleteModalRef = React.useRef<HTMLDialogElement>(null);
  const configurationModalRef = React.useRef<HTMLDialogElement>(null);
  const [notes, setNotes] = useState<NoteMetaData[]>([]);
  const [currentNote, setCurrentNote] = useState<YNote | null>(null);
  const [shouldFocus, setShouldFocus] = useState(false);

  async function createNoteAndSave() {
    const newNote = newNoteMetaData();
    await noteMetaDataService.saveNoteMetaData(newNote);
    return newNote;
  }

  async function setCurrent(noteId: string) {
    await currentNote?.persistence.destroy();
    currentNote?.doc.destroy();

    const noteMetaData = await noteMetaDataService.getNoteMetaData(noteId);
    if (!noteMetaData) {
      throw Error(`Note with ID '${noteId}' does not exist`);
    }
    setCurrentNote(await noteService.loadNote(noteId));
  }

  useEffect(() => {
    const fetchNotes = async () => {
      const notesInStorage = await noteMetaDataService.listNoteMetaData();
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
    const newNote = newNoteMetaData();
    setCurrent(newNote.id);
    noteMetaDataService.saveNoteMetaData(newNote);
    setShouldFocus(true);
    setNotes([newNote, ...notes]);
    return newNote;
  };

  const handleNoteClick = async (id: string) => {
    const note = await noteMetaDataService.getNoteMetaData(id);
    if (note) {
      setCurrent(note.id);
      if (drawerRef.current) {
        drawerRef.current.checked = false; // Uncheck the drawer checkbox to close the drawer
      }
    }
  };

  const handleDeleteNote = async () => {
    if (currentNote) {
      await noteMetaDataService.deleteNoteMetaData(currentNote.noteId);
      await noteService.deleteNote(currentNote);

      const updatedNotes = notes.filter((note) =>
        note.id !== currentNote.noteId
      );
      if (updatedNotes.length > 0) {
        setNotes(updatedNotes);
        const nextNote = await noteMetaDataService.getNoteMetaData(updatedNotes[0].id);
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
        const markdown = editorRef.current?.getMarkdown() ?? "";
        const maxTitleLength = 50;
        let title =
          markdown.split("\n")[0].substring(0, maxTitleLength * 2).replace(
            /^#+/,
            "",
          ).replaceAll("&#x20;", "").trim() || defaultTitle;
        if (title.length > maxTitleLength) {
          title = title.substring(0, maxTitleLength).trim() + "...";
        }
        const updatedNote: NoteMetaData = {
          id: currentNote.noteId,
          title,
          lastModified: Date.now(),
        };
        // setCurrent(updatedNote);
        await noteMetaDataService.saveNoteMetaData(updatedNote);
        setNotes([
          updatedNote,
          ...notes.filter((note) => note.id !== updatedNote.id),
        ]);
      }
    }, 200);
  }

  function onMounted() {
    setTimeout(() => {
      editorRef.current?.connect();
      setTimeout(() => {
        if (shouldFocus) {
          editorRef.current?.focus();
          setShouldFocus(false);
        }
      });
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
              <button className="btn btn-primary" onClick={handleDeleteNote}>
                Delete
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* Configuration Modal */}
      <dialog className="modal" ref={configurationModalRef}>
        <div className="modal-box">
          <form method="dialog">
            <button className="btn btn-circle btn-ghost absolute right-2 top-2 text-xl">
              <IoClose />
            </button>
          </form>
          <h3 className="text-lg font-bold">Configuration</h3>
          <fieldset className="fieldset mt-5">
            <legend className="fieldset-legend">
              Remote synchronization URL
            </legend>
            <input
              type="text"
              className="input"
              placeholder="Remote synchronization URL"
            />
          </fieldset>
          <fieldset className="fieldset mt-5">
            <legend className="fieldset-legend">
              Remote synchronization code
            </legend>
            <input
              type="text"
              className="input"
              placeholder="Remote synchronization code"
            />
          </fieldset>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <div className="drawer h-full">
        <input
          id="main-drawer"
          type="checkbox"
          className="drawer-toggle"
          ref={drawerRef}
        />
        <div className="drawer-content h-full min-h-full">
          {/* Page content here */}

          <div className="fixed start-0 top-0 z-1">
            <label
              htmlFor="main-drawer"
              className="btn btn-ghost drawer-button m-2 p-1 text-3xl text-secondary"
            >
              <GiHamburgerMenu />
            </label>

            <button
              className="btn btn-ghost text-3xl p-1 m-2 text-secondary"
              onClick={() => deleteModalRef.current?.showModal()}
              disabled={!currentNote}
            >
              <MdDeleteForever />
            </button>
          </div>

          <button
            className="btn btn-ghost text-3xl p-1 fixed top-0 end-0 m-2 z-1 text-secondary"
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
          <div className="menu bg-base-200 min-h-full w-80 p-4">
            <h1 className="text-xl">
              etiko<span className="font-bold text-primary">notes</span>
            </h1>
            <ul className="text-base-content text-ellipsis mt-3 w-full">
              {/* Sidebar content here */}
              {notes.map((note) => (
                <li key={note.id}>
                  <a
                    className={`block text-ellipsis w-70 overflow-hidden whitespace-nowrap ${
                      currentNote?.noteId === note.id ? "menu-active" : ""
                    }`}
                    onClick={() => handleNoteClick(note.id)}
                  >
                    {note.title}
                    <span className="block text-xs font-semibold opacity-60">
                      {new Date(note.lastModified).toLocaleString()}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <button
              className="btn btn-ghost text-2xl p-1 m-2 text-secondary fixed top-0 right-0 z-10"
              onClick={() => configurationModalRef.current?.showModal()}
              disabled={!currentNote}
            >
              <FaGear />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
