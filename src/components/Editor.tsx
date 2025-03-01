import React from 'react';

import { Crepe } from "@milkdown/crepe";
import { Milkdown, useEditor } from "@milkdown/react";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { replaceAll } from '@milkdown/kit/utils';
import { editorViewCtx, Editor as MilkdownEditor } from '@milkdown/kit/core'

import "@milkdown/crepe/theme/common/style.css";
// import "@milkdown/crepe/theme/nord.css";
import "./Editor.css";
import type { Note } from '../App';

export interface EditorRef {
  editor: MilkdownEditor;
  getMarkdown(): string;
  replaceAll: (markdown: string, flush: boolean) => void;
  focus(): void;
}

export interface EditorProps {
  currentNote: Note | null;
  ref: React.RefObject<EditorRef | null>;

  onMarkdownUpdated: () => void;
  onMounted: () => void;
}

function Editor(props: EditorProps) {
  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: props.currentNote?.text ?? '',
    });

    props.ref.current = {
      focus: () => crepe.editor.ctx.get(editorViewCtx).focus(),
      getMarkdown: () => crepe.getMarkdown(),
      replaceAll: (markdown: string, flush: boolean = false) => crepe.editor.action(replaceAll(markdown, flush)),
      editor: crepe.editor,
    };

    crepe.editor
      .config((ctx) => {
        const listener = ctx.get(listenerCtx);

        listener.updated(() => {
          props.onMarkdownUpdated();
        });

        listener.mounted(() => {
          props.onMounted()
        });
      })
      .use(listener);

    return crepe;
  }, [props.currentNote?.id ?? 'null']);

  return <Milkdown />;
}

export default Editor;
