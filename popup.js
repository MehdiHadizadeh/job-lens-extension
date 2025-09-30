// popup.js

class PopupController {
  constructor() {
    this.elements = {
      searchPriority: document.getElementById("search-priority"),
      openNotesBtn: document.getElementById("open-notes"),
      statusEnabled: document.getElementById("status-enabled"),
      statusDisabled: document.getElementById("status-disabled"),
    };

    this.DEFAULT_PRIORITY = "website_first";
  }

  async init() {
    await this.loadSettings();
    this.attachEventListeners();
  }

  async loadSettings() {
    try {
      const {
        searchPriority = this.DEFAULT_PRIORITY,
        isExtensionEnabled = true,
      } = await chrome.storage.sync.get([
        "searchPriority",
        "isExtensionEnabled",
      ]);

      this.elements.searchPriority.value = searchPriority;
      this.elements.statusEnabled.checked = isExtensionEnabled;
      this.elements.statusDisabled.checked = !isExtensionEnabled;
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }

  attachEventListeners() {
    // Search priority change
    this.elements.searchPriority.addEventListener("change", () =>
      this.handlePriorityChange()
    );

    // Extension status change
    document
      .querySelectorAll('input[name="extension-status"]')
      .forEach((radio) => {
        radio.addEventListener("change", (e) => this.handleStatusChange(e));
      });

    // Open notes page
    this.elements.openNotesBtn.addEventListener("click", () =>
      chrome.runtime.openOptionsPage()
    );
  }

  async handlePriorityChange() {
    try {
      await chrome.storage.sync.set({
        searchPriority: this.elements.searchPriority.value,
      });
    } catch (error) {
      console.error("Failed to save search priority:", error);
    }
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
