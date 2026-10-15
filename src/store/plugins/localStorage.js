import { libraryScope, saveLibraryField } from '@/utils/offlineLibrary';

export default store => {
  store.subscribe((mutation, state) => {
    if (mutation.type === 'updateLikedXXX') {
      saveLibraryField(
        libraryScope(state.data),
        mutation.payload.name,
        mutation.payload.data
      );
    }
    localStorage.setItem('settings', JSON.stringify(state.settings));
    localStorage.setItem('data', JSON.stringify(state.data));
  });
};
