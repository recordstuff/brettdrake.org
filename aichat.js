"use strict";

(() => {
  const endpoint = "https://brettdrake.org:8080/Chat";
  const aiChatPromptInput = document.getElementById("aiChatPrompt");
  const aiChatMessages = document.getElementById("aiChatMessages");
  const aiChatSendButton = document.getElementById("aiChatSendButton");
  const aiChatStopButton = document.getElementById("aiChatStopButton");
  const aiChatStatusText = document.getElementById("aiChatStatusText");
  const aiChatModelSelect = document.getElementById("aiChatModelSelect");
  const aiChatChangeModelButton = document.getElementById("aiChatChangeModelButton");
  const aiChatModelStatus = document.getElementById("aiChatModelStatus");
  const aiChatModelStatusText = document.getElementById("aiChatModelStatusText");
  const aiChatModelSpinner = document.getElementById("aiChatModelSpinner");
  const aiChatModelDialog = document.getElementById("aiChatModelDialog");
  const aiChatModelDialogMessage = document.getElementById("aiChatModelDialogMessage");
  const aiChatConfirmModelButton = document.getElementById("aiChatConfirmModelButton");
  let loadedModelKey = "";
  let modelChangeInProgress = false;
  let activeRequest = null;

  function setModelStatus(message, state, isLoading = false) {
    aiChatModelStatusText.textContent = message;
    aiChatModelStatus.dataset.state = state;
    aiChatModelSpinner.hidden = !isLoading;
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
      || Boolean(activeRequest)
      || !modelChanged;
  }

  async function loadModelOptions() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
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
        setModelStatus("Loaded model: None", "checking");
      }

      updateChangeModelButton();
    } catch (error) {
      setModelStatus("Loaded model: Unable to determine", "error");
      console.error("Chat model information is unavailable.", error);
    } finally {
      clearTimeout(timer);
      aiChatModelSpinner.hidden = true;
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
      aiChatModelSelect.disabled = false;
      aiChatSendButton.disabled = false;
      aiChatModelSpinner.hidden = true;
      updateChangeModelButton();
    }
  }

  function scrollAiChatToBottom() {
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  }

  function addAiChatMessage(role, text = "") {
    const wrapper = document.createElement("div");
    wrapper.className = `ai-chat-message ai-chat-${role}`;
    const label = document.createElement("strong");
    label.textContent = "Assistant";
    if (role === "user") {
      label.textContent = "You";
    }
    const bubble = document.createElement("div");
    bubble.className = "ai-chat-message-bubble";
    bubble.textContent = text;
    wrapper.append(label, bubble);
    aiChatMessages.append(wrapper);
    scrollAiChatToBottom();
    return { wrapper, bubble };
  }

  function renderReply(bubble, text) {
    // Keep plain text if either optional Markdown dependency failed to load.
    if (window.marked && window.DOMPurify) {
      bubble.innerHTML = window.DOMPurify.sanitize(window.marked.parse(text));
      bubble.classList.add("ai-chat-markdown");
    } else {
      bubble.textContent = text;
    }
  }

  async function sendAiChatPrompt() {
    const prompt = aiChatPromptInput.value.trim();
    if (!prompt || activeRequest) {
      return;
    }
    const controller = new AbortController();
    activeRequest = controller;
    aiChatSendButton.disabled = true;
    aiChatStopButton.hidden = false;
    updateChangeModelButton();
    aiChatStatusText.textContent = "Thinking…";
    addAiChatMessage("user", prompt);
    aiChatPromptInput.value = "";
    const assistantMessage = addAiChatMessage("assistant");
    assistantMessage.wrapper.setAttribute("aria-busy", "true");
    const dots = document.createElement("span");
    dots.className = "ai-chat-typing-dots";
    dots.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 3; index++) {
      dots.append(document.createElement("span"));
    }
    assistantMessage.bubble.append(dots);
    let fullResponse = "";
    let timedOut = false;
    let timer;
    let reader;
    function resetTimeout() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 60000);
    }
    resetTimeout();
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompt),
        signal: controller.signal
      });
      if (!response.ok || !response.body) {
        throw new Error(`Chat request failed: ${response.status}`);
      }
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        resetTimeout();
        if (done) {
          fullResponse = `${fullResponse}${decoder.decode()}`;
          break;
        }
        fullResponse = `${fullResponse}${decoder.decode(value, { stream: true })}`;
        if (fullResponse.trim()) {
          assistantMessage.bubble.textContent = fullResponse;
          aiChatStatusText.textContent = "Replying…";
          scrollAiChatToBottom();
        }
      }
      if (!fullResponse.trim()) {
        throw new Error("The model returned an empty reply.");
      }
      renderReply(assistantMessage.bubble, fullResponse);
      aiChatStatusText.textContent = "Ready";
    } catch (error) {
      let message = "Unable to get a reply. Please try again.";
      if (controller.signal.aborted) {
        message = "Reply stopped.";
        if (timedOut) {
          message = "The reply timed out. Please try again.";
        }
      } else {
        console.error("Chat request failed.", error);
      }
      aiChatStatusText.textContent = message;
      if (fullResponse.trim()) {
        renderReply(assistantMessage.bubble, fullResponse);
      } else {
        assistantMessage.bubble.textContent = message;
      }
    } finally {
      clearTimeout(timer);
      if (reader) {
        reader.releaseLock();
      }
      assistantMessage.wrapper.setAttribute("aria-busy", "false");
      activeRequest = null;
      aiChatSendButton.disabled = false;
      aiChatStopButton.hidden = true;
      updateChangeModelButton();
      scrollAiChatToBottom();
      aiChatPromptInput.focus({ preventScroll: true });
    }
  }

  document.getElementById("aiChatForm").addEventListener("submit", event => {
    event.preventDefault();
    sendAiChatPrompt();
  });
  aiChatPromptInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendAiChatPrompt();
    }
  });
  aiChatStopButton.addEventListener("click", () => {
    if (activeRequest) {
      activeRequest.abort();
    }
  });
  aiChatModelSelect.addEventListener("change", updateChangeModelButton);
  aiChatChangeModelButton.addEventListener("click", () => {
    const selectedModelKey = aiChatModelSelect.value;
    aiChatModelDialogMessage.textContent =
      `Load model “${selectedModelKey}”? This could take several minutes.`;
    aiChatModelDialog.showModal();
  });
  aiChatConfirmModelButton.addEventListener("click", event => {
    event.preventDefault();
    aiChatModelDialog.close();
    changeModel();
  });
  aiChatModelDialog.addEventListener("click", event => {
    if (event.target === aiChatModelDialog) {
      aiChatModelDialog.close();
    }
  });
  loadModelOptions();
})();
