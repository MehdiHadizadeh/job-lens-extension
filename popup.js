class PopupController {
  constructor() {
    this.elements = {
      openNotesBtn: document.getElementById("open-notes"),
      extensionToggle: document.getElementById("extension-toggle"),
      jobinjaToggle: document.getElementById("jobinja-toggle"),
      jobvisionToggle: document.getElementById("jobvision-toggle"),
      versionEl: document.getElementById("extension-version"),
    };
  }

  async init() {
    this.setVersionFromManifest();
    await this.loadSettings();
    this.attachEventListeners();
    this.updateSubsiteTogglesState();
  }

  setVersionFromManifest() {
    if (this.elements.versionEl) {
      const manifestData = chrome.runtime.getManifest();
      this.elements.versionEl.textContent = `نسخه: ${manifestData.version}`;
      console.log("Extension version:", manifestData.version);
    }
  }

  async loadSettings() {
    try {
      const {
        isExtensionEnabled = true,
        isJobinjaEnabled = true,
        isJobvisionEnabled = true,
      } = await chrome.storage.sync.get([
        "isExtensionEnabled",
        "isJobinjaEnabled",
        "isJobvisionEnabled",
      ]);

      this.elements.extensionToggle.checked = isExtensionEnabled;
      this.elements.jobinjaToggle.checked = isJobinjaEnabled;
      this.elements.jobvisionToggle.checked = isJobvisionEnabled;

      console.log("Settings loaded:", {
        isExtensionEnabled,
        isJobinjaEnabled,
        isJobvisionEnabled,
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }

  attachEventListeners() {
    // Toggle Extension
    this.elements.extensionToggle.addEventListener("change", async (e) => {
      const enabled = e.target.checked;
      try {
        await chrome.storage.sync.set({ isExtensionEnabled: enabled });
        console.log("Extension toggled:", enabled);
        this.updateSubsiteTogglesState();
      } catch (error) {
        console.error("Failed to update extension status:", error);
      }
    });

    // Toggle jobinja
    this.elements.jobinjaToggle.addEventListener("change", async (e) => {
      try {
        await chrome.storage.sync.set({ isJobinjaEnabled: e.target.checked });
        console.log("Jobinja toggled:", e.target.checked);
      } catch (error) {
        console.error("Failed to update jobinja status:", error);
      }
    });

    // Toggle jobvision
    this.elements.jobvisionToggle.addEventListener("change", async (e) => {
      try {
        await chrome.storage.sync.set({ isJobvisionEnabled: e.target.checked });
        console.log("Jobvision toggled:", e.target.checked);
      } catch (error) {
        console.error("Failed to update jobvision status:", error);
      }
    });

    // Open notes page
    this.elements.openNotesBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
      console.log("Opening notes page...");
    });
  }

  updateSubsiteTogglesState() {
    const isEnabled = this.elements.extensionToggle.checked;

    this.elements.jobinjaToggle.disabled = !isEnabled;
    this.elements.jobvisionToggle.disabled = !isEnabled;

    if (!isEnabled) {
      this.elements.jobinjaToggle.checked = false;
      this.elements.jobvisionToggle.checked = false;
      chrome.storage.sync.set({
        isJobinjaEnabled: false,
        isJobvisionEnabled: false,
      });
      console.log("Extension disabled, subsite toggles reset");
    }
  }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  const popup = new PopupController();
  popup.init();
});
