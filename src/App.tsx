import { MilkdownProvider } from "@milkdown/react";

import { GiHamburgerMenu } from "react-icons/gi";

import Editor from "./components/Editor";
import "./App.css";

function App() {
  return (
    <>
      <div className="drawer h-full">
        <input id="my-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content h-full min-h-full">
          {/* Page content here */}
          <label
            htmlFor="my-drawer"
            className="btn btn-soft drawer-button fixed m-2 z-1 opacity-50"
          >
            <GiHamburgerMenu />
          </label>
          <MilkdownProvider>
            <Editor />
          </MilkdownProvider>
        </div>
        <div className="drawer-side z-2">
          <label
            htmlFor="my-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
          >
          </label>
          <ul className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
            {/* Sidebar content here */}
            <li>
              <a>Sidebar Item 1</a>
            </li>
            <li>
              <a>Sidebar Item 2</a>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

export default App;
