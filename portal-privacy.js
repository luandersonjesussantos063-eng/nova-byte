document.addEventListener('click', function (event) {
  const link = event.target.closest('[data-nb-privacy]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (typeof window.googlefc?.showRevocationMessage === 'function') {
    event.preventDefault();
    window.googlefc.showRevocationMessage();
  }
});
