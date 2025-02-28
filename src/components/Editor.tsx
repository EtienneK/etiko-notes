import React from 'react';

import { Crepe } from "@milkdown/crepe";
import { Milkdown, useEditor } from "@milkdown/react";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { replaceAll } from '@milkdown/kit/utils';
import { editorViewCtx } from '@milkdown/kit/core'

import "@milkdown/crepe/theme/common/style.css";
// import "@milkdown/crepe/theme/nord.css";
import "./Editor.css";

const markdown = `# Milkdown React Crepe

> You're scared of a world where you're needed.

This is a demo for using Crepe with **React**.

\`hello world\`

\`\`\`C
int main() {
  printf("Hello, World!");
}
\`\`\`

---

Hello!

`;

export interface EditorRef {
  getMarkdown(): string;
  replaceAll: (markdown: string, flush: boolean) => void;
  focus(): void;
}

export interface EditorProps {
  ref: React.RefObject<EditorRef | null>;
  onMarkdownUpdated: () => void;
}

function Editor(props: EditorProps) {
  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: markdown,
    });

    if (props.ref) {
      props.ref.current = {
        focus: () => crepe.editor.ctx.get(editorViewCtx).focus(),
        getMarkdown: () => crepe.getMarkdown(),
        replaceAll: (markdown: string, flush: boolean = false) => crepe.editor.action(replaceAll(markdown, flush)),
      };
    }

    crepe.editor
      .config((ctx) => {
        const listener = ctx.get(listenerCtx);
        listener.updated(() => {
          props.onMarkdownUpdated();
        });
      })
      .use(listener);

    return crepe;
  }, []);

  return <Milkdown />;
}

export default Editor;
