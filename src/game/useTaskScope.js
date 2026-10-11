import {useEffect, useRef} from 'react';
import {createTaskScope} from './taskScope.js';
import {useGame} from './store.js';

export function useTaskScope() {
  const scope = useRef(null);
  // Even if a promise resolves before the profile-change render, it cannot award another kid.
  if (!scope.current) scope.current = createTaskScope(() => useGame.getState().slotVersion);
  useEffect(() => {
    scope.current.resume();
    return () => scope.current.dispose();
  }, []);
  return scope.current;
}
