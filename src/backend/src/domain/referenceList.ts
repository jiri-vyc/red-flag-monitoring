// M9: reference lists are versioned but not reviewed; evaluation takes the latest version.
export type ReferenceList = { id: string; code: string; title: string };

export type ReferenceListVersion = {
  id: string;
  listId: string;
  versionNo: number;
  sourceNote: string | null;
  createdAt: Date;
  items: string[];
};
