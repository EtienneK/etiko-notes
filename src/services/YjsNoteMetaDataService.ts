import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

export interface NoteMetaData {
  readonly id: string;
  title: string;
  lastModified: number;
}

export class YjsNoteMetaDataService {
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

export interface YNote {
  readonly noteId: string;
  readonly doc: Y.Doc;
  readonly persistence: IndexeddbPersistence;
}
