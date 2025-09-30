// popup.js

class PopupController {
  constructor() {
    this.elements = {
      openNotesBtn: document.getElementById("open-notes"),
      statusEnabled: document.getElementById("status-enabled"),
      statusDisabled: document.getElementById("status-disabled"),
    };
  }

  async init() {
    await this.loadSettings();
    this.attachEventListeners();
  }

  async loadSettings() {
    try {
      const { isExtensionEnabled = true } = 
        await chrome.storage.sync.get(["isExtensionEnabled"]);

      this.elements.statusEnabled.checked = isExtensionEnabled;
      this.elements.statusDisabled.checked = !isExtensionEnabled;
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }

  attachEventListeners() {
    // Extension status change
    document.querySelectorAll('input[name="extension-status"]').forEach((radio) => {
      radio.addEventListener("change", (e) => this.handleStatusChange(e));
    });

    // Open notes page
    this.elements.openNotesBtn.addEventListener("click", () => 
      chrome.runtime.openOptionsPage()
    );
  }

  async handleStatusChange(event) {
    try {
      const isEnabled = event.target.value === "enabled";
      await chrome.storage.sync.set({ isExtensionEnabled: isEnabled });
    } catch (error) {
      console.error("Failed to update extension status:", error);
    }
  }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  const popup = new PopupController();
  popup.init();
});