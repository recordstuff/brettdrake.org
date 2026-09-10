"use strict";

(() => {
  const endpoint = document.getElementById("aiChat").dataset.endpoint;
  const aiChatSendButton = document.getElementById("aiChatSendButton");
  const aiChatStatusText = document.getElementById("aiChatStatusText");
  const aiChatModelSelect = document.getElementById("aiChatModelSelect");
  const aiChatChangeModelButton = document.getElementById("aiChatChangeModelButton");
  const aiChatModelStatus = document.getElementById("aiChatModelStatus");
  const aiChatModelStatusText = document.getElementById("aiChatModelStatusText");
  const modelLoadingSpinner = document.getElementById("modelLoadingSpinner");
  let loadedModelKey = "";
  let modelChangeInProgress = false;
  let modelOptionsAvailable = false;
  let chatActive = false;

  function setModelStatus(message, state, isLoading = false) {
    aiChatModelStatusText.textContent = message;
    aiChatModelStatus.dataset.state = state;
    modelLoadingSpinner.hidden = !isLoading;
  }

  function updateChangeModelButton() {
    const selectedModelKey = aiChatModelSelect.value;
    let modelChanged = selectedModelKey !== loadedModelKey;
    if (!loadedModelKey) {
      modelChanged = Boolean(selectedModelKey);
    }

    aiChatChangeModelButton.disabled =
      aiChatModelSelect.disabled
      || modelChangeInProgress
      || chatActive
      || !modelChanged;
  }

  async function loadModelOptions() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    modelOptionsAvailable = false;
    aiChatModelSelect.disabled = true;
    aiChatChangeModelButton.disabled = true;
    setModelStatus("Loaded model: Checking…", "checking", true);

    try {
      const modelsResponse = await fetch(`${endpoint}/availablemodels`, {
        credentials: "include",
        signal: controller.signal
      });
      if (!modelsResponse.ok) {
        throw new Error(`Model list request failed: ${modelsResponse.status}`);
      }

      const availableModels = await modelsResponse.json();
      aiChatModelSelect.replaceChildren();
      for (const modelKey of availableModels) {
        const option = document.createElement("option");
        option.value = modelKey;
        option.textContent = modelKey;
        aiChatModelSelect.append(option);
      }

      if (!availableModels.length) {
        setModelStatus("Loaded model: No language models are available.", "error");
        return;
      }

      modelOptionsAvailable = true;
      aiChatModelSelect.disabled = false;
      const loadedResponse = await fetch(endpoint, {
        credentials: "include",
        signal: controller.signal
      });

      loadedModelKey = "";
      if (loadedResponse.ok) {
        loadedModelKey = (await loadedResponse.text()).trim();
        aiChatModelSelect.value = loadedModelKey;
        setModelStatus(`Loaded model: ${loadedModelKey}`, "loaded");
      } else {
        setModelStatus("No model is loaded", "checking");
      }

      updateChangeModelButton();
    } catch (error) {
      setModelStatus("Loaded model: Unable to determine", "error");
      console.error("Chat model information is unavailable.", error);
    } finally {
      clearTimeout(timer);
      modelLoadingSpinner.hidden = true;
    }
  }

  async function changeModel() {
    const selectedModelKey = aiChatModelSelect.value;
    modelChangeInProgress = true;
    aiChatModelSelect.disabled = true;
    aiChatSendButton.disabled = true;
    updateChangeModelButton();
    setModelStatus(`Loading model: ${selectedModelKey}…`, "loading", true);

    try {
      const response = await fetch(`${endpoint}/loadedmodel`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedModelKey)
      });
      if (!response.ok) {
        throw new Error(`Model change request failed: ${response.status}`);
      }

      loadedModelKey = (await response.text()).trim();
      aiChatModelSelect.value = loadedModelKey;
      setModelStatus(`Loaded model: ${loadedModelKey}`, "loaded");
    } catch (error) {
      aiChatStatusText.textContent = "Unable to change the language model.";
      console.error("Unable to change the language model.", error);
      await loadModelOptions();
    } finally {
      modelChangeInProgress = false;
      if (modelOptionsAvailable) {
        aiChatModelSelect.disabled = false;
      } else {
        aiChatModelSelect.disabled = true;
      }
      aiChatSendButton.disabled = false;
      modelLoadingSpinner.hidden = true;
      updateChangeModelButton();
    }
  }

  aiChatModelSelect.addEventListener("change", updateChangeModelButton);
  aiChatChangeModelButton.addEventListener("click", async () => {
    const selectedModelKey = aiChatModelSelect.value;
    const confirmed = await window.siteDialog.confirm({
      title: "Change language model",
      message: `Load model “${selectedModelKey}”? This could take several minutes.`,
      cancelText: "Cancel",
      confirmText: "Load model"
    });
    if (confirmed) {
      changeModel();
    }
  });
  document.addEventListener("ai-chat-active", event => {
    chatActive = Boolean(event.detail);
    updateChangeModelButton();
  });

  loadModelOptions();
})();
