'use client';

import Modal from './Modal';
import FileUpload from './FileUpload';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (fileUuid: string, originalFilename: string) => void;
}

export default function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const handleUploadSuccess = (fileUuid: string, originalFilename: string) => {
    onUploadSuccess(fileUuid, originalFilename);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload PDF">
      <FileUpload onUploadSuccess={handleUploadSuccess} />
    </Modal>
  );
}
