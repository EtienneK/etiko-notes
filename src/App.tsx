import { MilkdownProvider } from "@milkdown/react";
import Editor from "./components/Editor";
import './App.css'

function App() {
  return (
    <>
      <MilkdownProvider>
        <Editor />
      </MilkdownProvider>
    </>
  )
}

export default App
