import type { ComponentType } from "react";
import MergeTool from "@/components/tools/MergeTool";
import SplitTool from "@/components/tools/SplitTool";
import OrganizeTool from "@/components/tools/OrganizeTool";
import RotateTool from "@/components/tools/RotateTool";
import PdfToImageTool from "@/components/tools/PdfToImageTool";
import ImageToPdfTool from "@/components/tools/ImageToPdfTool";

export type Category = "Organize & merge" | "Convert";

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: Category;
  /** Short monospace glyph shown in the nav / cards. */
  glyph: string;
  /** All tools are genuinely functional; flagged "live" in the UI. */
  live: boolean;
  Component: ComponentType;
}

export const CATEGORIES: Category[] = ["Organize & merge", "Convert"];

/** Short path-style abbreviation per category (e.g. ~/org). */
export const CAT_ABBR: Record<Category, string> = {
  "Organize & merge": "org",
  Convert: "conv",
};

export const TOOLS: Tool[] = [
  // Organize & merge
  { id: "merge", name: "Merge PDF", description: "Combine multiple PDFs into one, in any order", category: "Organize & merge", glyph: "⧉", live: true, Component: MergeTool },
  { id: "split", name: "Split PDF", description: "Extract a page range or split into single pages", category: "Organize & merge", glyph: "✂", live: true, Component: SplitTool },
  { id: "organize", name: "Organize Pages", description: "Reorder, rotate & delete pages visually", category: "Organize & merge", glyph: "▦", live: true, Component: OrganizeTool },
  { id: "rotate", name: "Rotate PDF", description: "Rotate all or selected pages", category: "Organize & merge", glyph: "↻", live: true, Component: RotateTool },
  // Convert
  { id: "pdf-to-jpg", name: "PDF → Image", description: "Render each page to JPG or PNG", category: "Convert", glyph: "⊞", live: true, Component: PdfToImageTool },
  { id: "jpg-to-pdf", name: "Image → PDF", description: "Combine JPG / PNG images into one PDF", category: "Convert", glyph: "⊟", live: true, Component: ImageToPdfTool },
];
