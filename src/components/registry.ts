import type { ComponentType } from "react";
import MergeTool from "@/components/tools/MergeTool";
import SplitTool from "@/components/tools/SplitTool";
import OrganizeTool from "@/components/tools/OrganizeTool";
import RotateTool from "@/components/tools/RotateTool";
import PdfToImageTool from "@/components/tools/PdfToImageTool";
import ImageToPdfTool from "@/components/tools/ImageToPdfTool";
import PageNumbersTool from "@/components/tools/PageNumbersTool";
import WatermarkTool from "@/components/tools/WatermarkTool";
import FillSignTool from "@/components/tools/FillSignTool";
import FormFillTool from "@/components/tools/FormFillTool";
import CropTool from "@/components/tools/CropTool";
import CompressTool from "@/components/tools/CompressTool";

export type Category = "Organize & merge" | "Edit & sign" | "Convert" | "Optimize";

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

export const CATEGORIES: Category[] = [
  "Organize & merge",
  "Edit & sign",
  "Convert",
  "Optimize",
];

/** Short path-style abbreviation per category (e.g. ~/org). */
export const CAT_ABBR: Record<Category, string> = {
  "Organize & merge": "org",
  "Edit & sign": "edit",
  Convert: "conv",
  Optimize: "opt",
};

export const TOOLS: Tool[] = [
  // Organize & merge
  { id: "merge", name: "Merge PDF", description: "Combine multiple PDFs into one, in any order", category: "Organize & merge", glyph: "⧉", live: true, Component: MergeTool },
  { id: "split", name: "Split PDF", description: "Extract a page range or split into single pages", category: "Organize & merge", glyph: "✂", live: true, Component: SplitTool },
  { id: "organize", name: "Organize Pages", description: "Reorder, rotate & delete pages visually", category: "Organize & merge", glyph: "▦", live: true, Component: OrganizeTool },
  { id: "rotate", name: "Rotate PDF", description: "Rotate all or selected pages", category: "Organize & merge", glyph: "↻", live: true, Component: RotateTool },
  { id: "crop", name: "Crop PDF", description: "Trim margins from pages with a live preview", category: "Organize & merge", glyph: "▭", live: true, Component: CropTool },
  // Edit & sign
  { id: "page-numbers", name: "Page Numbers", description: "Stamp page numbers in any corner", category: "Edit & sign", glyph: "#", live: true, Component: PageNumbersTool },
  { id: "watermark", name: "Watermark", description: "Overlay a text or image watermark", category: "Edit & sign", glyph: "❖", live: true, Component: WatermarkTool },
  { id: "fill-sign", name: "Fill & Sign", description: "Add text & a signature, then place them", category: "Edit & sign", glyph: "✎", live: true, Component: FillSignTool },
  { id: "fill-forms", name: "Fill Forms", description: "Fill native AcroForm form fields", category: "Edit & sign", glyph: "▤", live: true, Component: FormFillTool },
  // Convert
  { id: "pdf-to-jpg", name: "PDF → Image", description: "Render each page to JPG or PNG", category: "Convert", glyph: "⊞", live: true, Component: PdfToImageTool },
  { id: "jpg-to-pdf", name: "Image → PDF", description: "Combine JPG / PNG images into one PDF", category: "Convert", glyph: "⊟", live: true, Component: ImageToPdfTool },
  // Optimize
  { id: "compress", name: "Compress PDF", description: "Shrink file size by re-encoding pages", category: "Optimize", glyph: "⇊", live: true, Component: CompressTool },
];
