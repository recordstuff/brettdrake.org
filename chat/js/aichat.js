"use strict";

(() => {
  const aiChat = document.getElementById("aiChat");
  const endpoint = aiChat.dataset.endpoint;
  const aiChatForm = document.getElementById("aiChatForm");
  const aiChatPromptInput = document.getElementById("aiChatPrompt");
  const aiChatMessages = document.getElementById("aiChatMessages");
  const aiChatSendButton = document.getElementById("aiChatSendButton");
  const aiChatStopButton = document.getElementById("aiChatStopButton");
  const aiChatStatusText = document.getElementById("aiChatStatusText");
  let activeRequest = null;

  function updateComposerClearance() {
    const clearance = aiChatForm.getBoundingClientRect().height + 24;
    aiChat.style.setProperty("--ai-chat-composer-clearance", `${clearance}px`);
  }

  const composerResizeObserver = new ResizeObserver(updateComposerClearance);
  composerResizeObserver.observe(aiChatForm);
  updateComposerClearance();

  function setChatActive(isActive) {
    document.dispatchEvent(new CustomEvent("ai-chat-active", { detail: isActive }));
  }

  function scrollAiChatToBottom() {
    window.scrollTo(0, document.documentElement.scrollHeight);
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
    setChatActive(true);
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
      setChatActive(false);
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
})();
