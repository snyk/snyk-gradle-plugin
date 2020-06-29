export function findCycles(
  ancestorsChain,
  childrenChain,
  parentId: string,
  currentNode: string,
  alreadyVisited: Set<unknown>,
) {
  if (ancestorsChain && childrenChain && parentId && currentNode) {
    const currentAncestors = ancestorsChain.get(parentId);
    const currentChildren = childrenChain.get(currentNode);
    if (parentId === currentNode) {
      return true;
    }

    if (currentAncestors) {
      if (
        currentAncestors.includes(currentNode) ||
        currentAncestors.includes(parentId)
      ) {
        return true;
      }
      for (const ancestor of currentAncestors) {
        if (!alreadyVisited.has(ancestor) && ancestor !== currentNode) {
          alreadyVisited.add(ancestor);
          return findCycles(
            ancestorsChain,
            childrenChain,
            ancestor,
            currentNode,
            alreadyVisited,
          );
        }
      }
    } else if (currentChildren) {
      if (
        currentChildren.includes(parentId) ||
        currentChildren.includes(currentNode)
      ) {
        return true;
      }
      for (const children of currentChildren) {
        if (!alreadyVisited.has(children) && children !== parentId) {
          alreadyVisited.add(children);
          return findCycles(
            ancestorsChain,
            childrenChain,
            children,
            currentNode,
            alreadyVisited,
          );
        }
      }
    }
  }
  return false;
}
