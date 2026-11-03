export const STANDARD_FILE_LIMIT = 9_999_999;
export const ARCHIVE_FILE_LIMIT = 125_000_000;

export function isArchiveName(name) {
  return /\.(?:zip|rar|7z|tar|gz|tgz|bz2|tbz2|xz|txz)$/i.test(String(name || '').trim());
}

export function archivePriority(file, options) {
  return options?.prioritizeArchives === true && isArchiveName(file.name) &&
    !file.external && !file.imageExcluded &&
    (file.size == null || Number(file.size) <= ARCHIVE_FILE_LIMIT);
}

export function downloadLimit(file, options) {
  return options?.prioritizeArchives === true && isArchiveName(file.name) && !file.external
    ? ARCHIVE_FILE_LIMIT : STANDARD_FILE_LIMIT;
}

export function refreshArchiveEligibility(job) {
  // Older attachment scans could omit archive-only MIME types entirely.
  const discoverOldArchives = job.options?.prioritizeArchives === true &&
    job.options.attachments !== false && !job.archiveAttachmentBackfillQueued;
  const updateFile = file => {
    if (file.historical || file.external || file.imageExcluded || file.localWriteSkipped ||
        file.parked || file.attempts >= 2 || file.status === 'saved' || file.size == null) return false;
    const tooLarge = Number(file.size) > downloadLimit(file, job.options);
    if (tooLarge && ['pending', 'deferred'].includes(file.status)) {
      file.status = 'manual';
      file.sizeLimited = true;
    } else if (!tooLarge && archivePriority(file, job.options) &&
               ['manual', 'skipped-too-large'].includes(file.status) &&
               (file.sizeLimited || Number(file.size) > STANDARD_FILE_LIMIT)) {
      file.status = 'pending';
      file.sizeLimited = false;
      file.autoRetry = true;
      file.error = null;
      return true;
    }
    return false;
  };

  for (const file of Object.values(job.library?.entries || {})) updateFile(file);
  for (const file of Object.values(job.fileLinks?.sources || {})) updateFile(file);
  for (const entry of Object.values(job.entries || {})) {
    let reopened = false;
    for (const file of entry.attachments || []) {
      if (updateFile(file)) reopened = true;
    }
    if ((reopened || discoverOldArchives) && entry.status === 'saved') {
      if (!entry.attachmentPending) entry.attachmentRetryAt = 0;
      entry.attachmentPending = true;
      entry.attachmentCursor = 0;
    }
  }
  if (discoverOldArchives) job.archiveAttachmentBackfillQueued = true;
}
