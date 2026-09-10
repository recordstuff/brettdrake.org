"use strict";

(() => {
  const dialog = document.getElementById("confirmationDialog");
  const title = document.getElementById("confirmationDialogTitle");
  const message = document.getElementById("confirmationDialogMessage");
  const cancelButton = document.getElementById("confirmationDialogCancelButton");
  const confirmButton = document.getElementById("confirmationDialogConfirmButton");
  let resolveConfirmation = null;

  function closeDialog(result) {
    dialog.close();
    if (resolveConfirmation) {
      resolveConfirmation(result);
      resolveConfirmation = null;
    }
  }

  cancelButton.addEventListener("click", event => {
    event.preventDefault();
    closeDialog(false);
  });
  confirmButton.addEventListener("click", event => {
    event.preventDefault();
    closeDialog(true);
  });
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeDialog(false);
  });
  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      closeDialog(false);
    }
  });

  window.siteDialog = {
    confirm(options) {
      if (resolveConfirmation) {
        return Promise.reject(new Error("A confirmation dialog is already open."));
      }

      title.textContent = options.title;
      message.textContent = options.message;
      cancelButton.textContent = options.cancelText;
      confirmButton.textContent = options.confirmText;

      return new Promise(resolve => {
        resolveConfirmation = resolve;
        dialog.showModal();
      });
    }
  };
})();
