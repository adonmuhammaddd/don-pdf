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
import HtmlToPdfTool from "@/components/tools/HtmlToPdfTool";

export type Category = "Organize" | "Convert" | "Edit & Sign" | "Optimize";

export interface Tool {
  id: string;
  name: string;
  /** Short card/blurb line. */
  description: string;
  /** Friendly tagline shown in the tool header. */
  tagline: string;
  category: Category;
  /** Icon name from the design icon set. */
  icon: string;
  Component: ComponentType;
}

export const CATEGORIES: Category[] = ["Organize", "Convert", "Edit & Sign", "Optimize"];

export const TOOLS: Tool[] = [
  // Organize
  { id: "merge", name: "Merge PDF", description: "Combine multiple PDFs into one tidy document.", tagline: "Drop your PDFs, drag to reorder, and merge.", category: "Organize", icon: "merge", Component: MergeTool },
  { id: "split", name: "Split PDF", description: "Separate one PDF into several files or ranges.", tagline: "Choose how you'd like to break it apart.", category: "Organize", icon: "split", Component: SplitTool },
  { id: "organize", name: "Organize Pages", description: "Reorder, rotate, and delete pages visually.", tagline: "Rearrange, rotate, or remove any page.", category: "Organize", icon: "organize", Component: OrganizeTool },
  { id: "rotate", name: "Rotate PDF", description: "Turn pages to the right orientation.", tagline: "Rotate all pages or just a range.", category: "Organize", icon: "rotate", Component: RotateTool },
  // Convert
  { id: "pdf-to-jpg", name: "PDF → Image", description: "Export each page as a PNG or JPG.", tagline: "Pick a format and quality — we'll do the rest.", category: "Convert", icon: "pdf2img", Component: PdfToImageTool },
  { id: "jpg-to-pdf", name: "Image → PDF", description: "Turn photos and scans into a PDF.", tagline: "Combine images into one PDF, in order.", category: "Convert", icon: "img2pdf", Component: ImageToPdfTool },
  { id: "html-to-pdf", name: "HTML → PDF", description: "Render an HTML page or snippet to a PDF.", tagline: "Paste HTML or drop an .html file — rendered on your device.", category: "Convert", icon: "html2pdf", Component: HtmlToPdfTool },
  // Edit & Sign
  { id: "fill-sign", name: "Fill & Sign", description: "Add text, dates, and your signature.", tagline: "Place text and your signature, then save.", category: "Edit & Sign", icon: "sign", Component: FillSignTool },
  { id: "watermark", name: "Watermark", description: "Stamp text or a logo across pages.", tagline: "Overlay text or an image on every page.", category: "Edit & Sign", icon: "watermark", Component: WatermarkTool },
  { id: "page-numbers", name: "Page Numbers", description: "Add page numbers in any position.", tagline: "Stamp page numbers in any corner.", category: "Edit & Sign", icon: "numbers", Component: PageNumbersTool },
  { id: "crop", name: "Crop PDF", description: "Trim margins and tidy up the frame.", tagline: "Trim margins with a live preview.", category: "Edit & Sign", icon: "crop", Component: CropTool },
  { id: "fill-forms", name: "Fill Forms", description: "Fill native AcroForm form fields.", tagline: "We detected the form fields — just type.", category: "Edit & Sign", icon: "forms", Component: FormFillTool },
  // Optimize
  { id: "compress", name: "Compress PDF", description: "Shrink file size while keeping it crisp.", tagline: "We'll find the sweet spot between size and quality.", category: "Optimize", icon: "compress", Component: CompressTool },
];
