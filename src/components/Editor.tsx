import React from 'react';

import { Crepe } from "@milkdown/crepe";
import { Milkdown, useEditor } from "@milkdown/react";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { replaceAll } from '@milkdown/kit/utils';
import { editorViewCtx, editorViewOptionsCtx, Editor as MilkdownEditor } from '@milkdown/kit/core'
import { collab, collabServiceCtx } from "@milkdown/plugin-collab";

//import { WebsocketProvider } from 'y-websocket';

import "@milkdown/crepe/theme/common/style.css";
// import "@milkdown/crepe/theme/nord.css";
import "./Editor.css";
import { YNote } from '../services/notes';

export interface EditorRef {
  editor: MilkdownEditor;
  getMarkdown(): string;
  replaceAll: (markdown: string, flush: boolean) => void;
  focus(): void;
  connect(): void;
}

export interface EditorProps {
  currentNote: YNote | null;
  ref: React.RefObject<EditorRef | null>;
  readonly: boolean;

  onMarkdownUpdated: () => void;
  onMounted: () => void;
}

function Editor(props: EditorProps) {
  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: '',
    });

    props.ref.current = {
      focus: () => crepe.editor.ctx.get(editorViewCtx).focus(),
      getMarkdown: () => crepe.getMarkdown(),
      replaceAll: (markdown: string, flush: boolean = false) => crepe.editor.action(replaceAll(markdown, flush)),
      editor: crepe.editor,
      connect: () => {
        crepe.editor.action(ctx => {
          if (props.currentNote?.doc) {
            const collabService = ctx.get(collabServiceCtx);
            //const wsProvider = new WebsocketProvider("ws://localhost:1234", "r00m", props.currentNote.doc);
            collabService
              .bindDoc(props.currentNote.doc)
              .bindCtx(ctx)
              //.setAwareness(wsProvider.awareness)
              .connect();
          }
        });
      }
    };

    crepe.setReadonly(props.readonly);

    crepe.editor
      .config((ctx) => {
        const listener = ctx.get(listenerCtx);

        listener.updated(() => {
          props.onMarkdownUpdated();
        });

        listener.mounted(() => {
          props.onMounted()
        });

        // Add attributes to the editor container
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          attributes: {
            class: 'prose prose-lg lg:prose-xl xl:prose-2xl',
            spellcheck: 'true',
          },
        }));
      })
      .use(listener)
      .use(collab);

    return crepe;
  }, [props.currentNote?.noteId ?? 'null', props.readonly ]);

  return <Milkdown />;
}

export default Editor;
