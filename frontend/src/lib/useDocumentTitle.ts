import { useEffect } from "react";

/**
 * Sets the document title dynamically
 * @param title - The title to set
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
