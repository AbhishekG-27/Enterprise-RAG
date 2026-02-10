'use client';

import Modal from './Modal';
import FileList from './FileList';

interface DocumentSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFileId: string | null;
  onSelectFile: (fileId: string | null, fileName: string | null) => void;
  refreshTrigger: number;
}

export default function DocumentSelectModal({
  isOpen,
  onClose,
  selectedFileId,
  onSelectFile,
  refreshTrigger,
}: DocumentSelectModalProps) {
  const handleSelectFile = (fileId: string | null, fileName: string | null) => {
    onSelectFile(fileId, fileName);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Document">
      <FileList
        selectedFileId={selectedFileId}
        onSelectFile={handleSelectFile}
        refreshTrigger={refreshTrigger}
      />
    </Modal>
  );
}
