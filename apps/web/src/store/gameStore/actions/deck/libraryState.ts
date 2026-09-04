export const isLibraryKnownEmpty = (libraryCount: number | undefined): boolean =>
  typeof libraryCount === "number" && libraryCount <= 0;
