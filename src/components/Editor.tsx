import { Crepe } from "@milkdown/crepe";
import { Milkdown, useEditor } from "@milkdown/react";

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

function Editor() {
  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: markdown,
    });
    return crepe;
  }, []);

  return <Milkdown />;
}

export default Editor;
