import { FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, File } from "lucide-react";
const MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText, doc: FileText, docx: FileText, txt: FileText, md: FileText,
  csv: FileSpreadsheet, xls: FileSpreadsheet, xlsx: FileSpreadsheet,
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, webp: FileImage, svg: FileImage,
  mp4: FileVideo, mov: FileVideo, webm: FileVideo,
  mp3: FileAudio, wav: FileAudio, m4a: FileAudio,
  zip: FileArchive, rar: FileArchive, "7z": FileArchive,
};
/** An icon for a filename, from its extension. Unknown types get a plain file. */
export function FileTypeIcon({ name, className }: { name: string; className?: string }) {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const Icon = MAP[ext] ?? File;
  return <Icon className={className ?? "size-4"} />;
}
