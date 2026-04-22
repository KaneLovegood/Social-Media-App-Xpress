export interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
  kind: 'image' | 'video' | 'file';
  progress?: number;
}

