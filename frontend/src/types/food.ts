/**
 * Interface representing a file with an associated comment and optional preview URL
 * Used for food photo uploads with individual comments per photo
 */
export interface FileWithComment {
  file: File;
  comment: string;
  previewUrl?: string; // For HEIC preview support
}
