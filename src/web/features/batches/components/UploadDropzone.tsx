"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";

import { LoadingRing } from "@/components/ui/LoadingRing";
import { ErrorState } from "@/components/ui/StateViews";
import { useI18n } from "@/i18n/I18nProvider";

import { useUploadBatch } from "../api/hooks";
import styles from "./UploadDropzone.module.css";

/** Uploads a transactions CSV and navigates to the new batch, where the evaluation progress is shown. */
export function UploadDropzone() {
  const { t } = useI18n();
  const router = useRouter();
  const uploadMutation = useUploadBatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const uploadFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    uploadMutation.mutate(file, { onSuccess: (batch) => router.push(`/batches/${batch.id}`) });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    uploadFile(event.dataTransfer.files[0]);
  };

  if (uploadMutation.isPending) {
    return <LoadingRing label={t.batches.uploading} />;
  }

  return (
    <div className={styles.container}>
      <div
        className={`${styles.dropzone} ${isDragActive ? styles.dragActive : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
      >
        <span className={styles.icon} aria-hidden="true">
          <FileSpreadsheet />
        </span>
        <h2>{t.batches.uploadTitle}</h2>
        <p className={styles.hint}>{t.batches.uploadHint}</p>
        <p>
          {t.batches.dropHere}{" "}
          <button type="button" className={styles.chooseButton} onClick={() => fileInputRef.current?.click()}>
            <Upload aria-hidden="true" />
            {t.batches.chooseFile}
          </button>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="visually-hidden"
          aria-label={t.batches.chooseFile}
          onChange={(event) => {
            uploadFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {uploadMutation.error && <ErrorState error={uploadMutation.error} />}
    </div>
  );
}
