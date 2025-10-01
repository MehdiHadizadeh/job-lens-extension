// notes.js

class NotesManager {
  constructor() {
    this.notesList = document.getElementById("notes-list");
    this.FEEDBACK_DURATION = 2000;
  }

  async init() {
    const notes = await this.loadNotes();
    this.render(notes);
  }

  async loadNotes() {
    const items = await chrome.storage.local.get(null);
    return Object.entries(items)
      .filter(([_, value]) => value?.companyName)
      .sort((a, b) => {
        const nameA = a[1].companyName || "";
        const nameB = b[1].companyName || "";
        return nameA.localeCompare(nameB, "fa", { sensitivity: "base" });
      });
  }

  render(notes) {
    if (notes.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.notesList.innerHTML = "";
    notes.forEach(([key, noteObj]) => {
      const noteItem = new NoteItem(key, noteObj, () =>
        this.handleNoteDeleted()
      );
      noteItem.appendTo(this.notesList);
    });
  }

  renderEmptyState() {
    this.notesList.innerHTML = `
      <div class="ext-not-found-message" 
           style="color: var(--color-text-dark); 
                  background-color: var(--color-bg-light); 
                  border: 1px solid var(--color-border-light);">
        🔍 هیچ یادداشتی ثبت نشده است.
      </div>
    `;
  }

  async handleNoteDeleted() {
    const remainingNotes = await this.loadNotes();
    if (remainingNotes.length === 0) {
      this.renderEmptyState();
    }
  }
}

class NoteItem {
  constructor(storageKey, noteData, onDeleteCallback) {
    this.storageKey = storageKey;
    this.noteData = noteData;
    this.onDeleteCallback = onDeleteCallback;
    this.container = null;
    this.textarea = null;
    this.saveBtn = null;
    this.deleteBtn = null;
  }

  appendTo(parent) {
    this.container = this.createContainer();
    parent.appendChild(this.container);
    this.attachEventListeners();
  }

  createContainer() {
    const div = document.createElement("div");
    div.className = "note-item py-0";
    div.innerHTML = `
      <div class="company-note">
        <h2>${this.noteData.companyName}</h2>
        <div class="note-actions">
          <button class="save ext-btn-primary">
        <svg role="img" aria-label="ذخیره" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path>
          <path d="M17 3v6H7V3"></path>
          <rect x="7" y="12" width="10" height="7" rx="1"></rect>
        </svg>

          ذخیره</button>
          <button class="delete ext-btn-danger">
          <svg role="img" aria-label="حذف" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
          </svg>

          حذف</button>
        </div>
      </div>
      <p class="mt-2 py-0 mb-0"><a class="fs-4" href="${this.noteData.jobUrl}" target="_blank">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      </svg>
      مشاهده آگهی</a></p>
      <textarea class="note-area">${this.noteData.note || ""}</textarea>
    `;

    this.textarea = div.querySelector("textarea");
    this.saveBtn = div.querySelector(".save");
    this.deleteBtn = div.querySelector(".delete");

    return div;
  }

  attachEventListeners() {
    this.saveBtn.addEventListener("click", () => this.handleSave());
    this.deleteBtn.addEventListener("click", () => this.handleDelete());
  }

  async handleSave() {
    const originalText = this.saveBtn.textContent;
    this.saveBtn.textContent = "در حال ذخیره...";
    this.saveBtn.disabled = true;

    const noteContent = this.textarea.value.trim();

    try {
      if (noteContent) {
        await this.saveNote(noteContent);
        this.showSaveSuccess();
      } else {
        await this.deleteNote();
        this.showDeleteSuccess();
      }
    } catch (error) {
      console.error("Failed to save note:", error);
      this.showError();
    }

    setTimeout(() => {
      this.saveBtn.textContent = originalText;
      this.saveBtn.disabled = false;
      this.saveBtn.className = "save ext-btn-primary";
      this.saveBtn.style.backgroundColor = "";
    }, 2000);
  }

  async handleDelete() {
    const confirmed = confirm(
      `آیا مطمئنید که می‌خواهید یادداشت "${this.noteData.companyName}" را حذف کنید؟`
    );

    if (!confirmed) return;

    try {
      await chrome.storage.local.remove(this.storageKey);
      this.container.remove();
      this.onDeleteCallback();
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  }

  async saveNote(content) {
    await chrome.storage.local.set({
      [this.storageKey]: {
        ...this.noteData,
        note: content,
      },
    });
  }

  async deleteNote() {
    await chrome.storage.local.remove(this.storageKey);

    setTimeout(() => {
      this.container.remove();
      this.onDeleteCallback();
    }, 1000);
  }

  showSaveSuccess() {
    this.saveBtn.textContent = "ذخیره شد ✓";
    this.saveBtn.className = "save";
  }

  showDeleteSuccess() {
    this.saveBtn.textContent = "حذف شد 🗑️";
    this.saveBtn.className = "save";
    this.saveBtn.style.backgroundColor = "var(--color-error)";
  }

  showError() {
    this.saveBtn.textContent = "خطا ❌";
    this.saveBtn.className = "save";
    this.saveBtn.style.backgroundColor = "var(--color-error)";
  }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  const notesManager = new NotesManager();
  notesManager.init();
});
