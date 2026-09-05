export type StableMountMutationRef<Key> = {
  current: Key | null;
};

export function runStableMountMutationOnce<Key>(
  handledRef: StableMountMutationRef<Key>,
  key: Key,
  mutation: () => boolean | void
): boolean {
  if (Object.is(handledRef.current, key)) {
    return false;
  }

  handledRef.current = key;
  const accepted = mutation();

  if (accepted === false) {
    handledRef.current = null;
  }

  return accepted !== false;
}
