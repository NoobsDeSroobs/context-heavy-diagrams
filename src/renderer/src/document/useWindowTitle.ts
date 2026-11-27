import { useEffect } from 'react'
import { windowTitle } from '@shared/document/windowTitle'

// Keeps the window's title in step with the open file and whether anything in it is unsaved
//The title is what the operating system shows in the title bar and the task bar.
export function useWindowTitle(currentPath: string | null, isDirty: boolean): void {
  useEffect(() => {
    document.title = windowTitle(currentPath, isDirty)
  }, [currentPath, isDirty])
}
