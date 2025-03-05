import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

export interface YNote {
  readonly noteId: string;
  readonly doc: Y.Doc;
  readonly persistence: IndexeddbPersistence;
}

export interface NoteMetaData {
  readonly id: string;
  title: string;
  lastModified: number;
}

export class NotebookService {
  readonly rootDoc: Y.Doc;
  private readonly notes: Y.Map<Y.Map<string | number | undefined>>;
  private readonly persistence: IndexeddbPersistence;

  constructor() {
    this.rootDoc = new Y.Doc();
    this.notes = this.rootDoc.getMap();
    this.persistence = new IndexeddbPersistence("notes-list", this.rootDoc);
  }

  async deleteNoteMetaData(noteId: string) {
    await this.persistence.whenSynced;
    this.notes.delete(noteId);
  }

  async getNoteMetaData(noteId: string): Promise<NoteMetaData | null> {
    await this.persistence.whenSynced;

    const note = this.notes.get(noteId);
    if (!note) return null;

    return {
      id: note.get("id") as string,
      title: note.get("title") as string,
      lastModified: note.get("lastModified") as number,
    } as NoteMetaData;
  }

  async saveNoteMetaData(metaData: NoteMetaData) {
    await this.persistence.whenSynced;

    const found = this.notes.get(metaData.id);
    if (found) {
      found.set("title", metaData.title);
      found.set("lastModified", metaData.lastModified);
    } else {
      const noteMap = new Y.Map<string | number | undefined>();

      noteMap.set("id", metaData.id);
      noteMap.set("title", metaData.title);
      noteMap.set("lastModified", metaData.lastModified);

      this.notes.set(metaData.id, noteMap);
    }
  }

  async listNoteMetaData() {
    await this.persistence.whenSynced;

    return Array.from(this.notes.keys()).map((id) => {
      const note = this.notes.get(id)!;
      return {
        id: note.get("id") as string,
        title: note.get("title") as string,
        lastModified: note.get("lastModified") as number,
      };
    }).sort((a, b) => b.lastModified - a.lastModified);
  }
}

export class NoteService {
  private async destroy(note: YNote): Promise<void> {
    try {
      await Promise.all([
        note.persistence.destroy(),
      ]);
    } finally {
      note.doc.destroy();
    }
  }

  async deleteNote(note: YNote) {
    await note.persistence.clearData();
    await this.destroy(note);
  }
}
